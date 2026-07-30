import { createHmac } from 'crypto';
import { LeadStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import {
  compareCallQueue,
  distributeRoundRobin,
  leadVisibilityWhere,
  normalizePhone,
  verifyWebsiteLeadSignature,
} from './leads-rules';

describe('normalizePhone', () => {
  it('приводит разные форматы одного номера к одному ключу', () => {
    expect(normalizePhone('+7 701 234 56 78')).toBe(normalizePhone('87012345678'));
  });

  it('null для пустого/слишком короткого значения', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
  });

  it('берёт последние 10 цифр', () => {
    expect(normalizePhone('+7 (701) 234-56-78')).toBe('7012345678');
  });
});

describe('distributeRoundRobin', () => {
  it('распределяет лиды по кругу поровну', () => {
    const result = distributeRoundRobin(['l1', 'l2', 'l3', 'l4'], ['m1', 'm2']);
    expect(result).toEqual([
      { leadId: 'l1', responsibleId: 'm1' },
      { leadId: 'l2', responsibleId: 'm2' },
      { leadId: 'l3', responsibleId: 'm1' },
      { leadId: 'l4', responsibleId: 'm2' },
    ]);
  });

  it('работает с одним менеджером (всё ему)', () => {
    const result = distributeRoundRobin(['l1', 'l2'], ['m1']);
    expect(result.every((item) => item.responsibleId === 'm1')).toBe(true);
  });
});

describe('compareCallQueue', () => {
  const today = new Date('2026-07-24T00:00:00.000Z');

  it('просроченный перезвон идёт выше обычного нового лида', () => {
    const overdueCallback = {
      status: LeadStatus.CALL_BACK,
      callBackAt: new Date('2026-07-23T00:00:00.000Z'),
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
    };
    const freshLead = {
      status: LeadStatus.NEW,
      callBackAt: null,
      createdAt: new Date('2026-07-24T00:00:00.000Z'),
    };
    expect(compareCallQueue(overdueCallback, freshLead, today)).toBeLessThan(0);
  });

  it('перезвон на сегодня тоже наверху', () => {
    const dueToday = {
      status: LeadStatus.CALL_BACK,
      callBackAt: new Date('2026-07-24T00:00:00.000Z'),
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
    };
    const other = { status: LeadStatus.IN_PROGRESS, callBackAt: null, createdAt: new Date('2026-07-01T00:00:00.000Z') };
    expect(compareCallQueue(dueToday, other, today)).toBeLessThan(0);
  });

  it('перезвон в будущем не имеет приоритета над обычными лидами', () => {
    const futureCallback = {
      status: LeadStatus.CALL_BACK,
      callBackAt: new Date('2026-07-25T00:00:00.000Z'),
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
    };
    const olderLead = { status: LeadStatus.NEW, callBackAt: null, createdAt: new Date('2026-07-10T00:00:00.000Z') };
    expect(compareCallQueue(futureCallback, olderLead, today)).toBeGreaterThan(0);
  });
});

describe('verifyWebsiteLeadSignature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ name: 'Тест' }));
  const validSignature = createHmac('sha256', secret).update(body).digest('hex');

  it('принимает верную подпись', () => {
    expect(verifyWebsiteLeadSignature(body, validSignature, secret)).toBe(true);
  });

  it('отклоняет неверную подпись', () => {
    expect(verifyWebsiteLeadSignature(body, 'a'.repeat(64), secret)).toBe(false);
  });

  it('отклоняет подпись другим секретом (тело изменено или подписано неверным ключом)', () => {
    const wrongSignature = createHmac('sha256', 'other-secret').update(body).digest('hex');
    expect(verifyWebsiteLeadSignature(body, wrongSignature, secret)).toBe(false);
  });

  it('отклоняет, если секрет не настроен на сервере', () => {
    expect(verifyWebsiteLeadSignature(body, validSignature, undefined)).toBe(false);
  });

  it('отклоняет отсутствующее тело или подпись', () => {
    expect(verifyWebsiteLeadSignature(undefined, validSignature, secret)).toBe(false);
    expect(verifyWebsiteLeadSignature(body, undefined, secret)).toBe(false);
  });

  it('не падает на подписи другой длины (короче/длиннее ожидаемой)', () => {
    expect(verifyWebsiteLeadSignature(body, 'ab', secret)).toBe(false);
    expect(verifyWebsiteLeadSignature(body, validSignature + 'ff', secret)).toBe(false);
  });
});

describe('Права доступа: видимость лидов (раздел 4.9 ТЗ)', () => {
  const DEPT_CHINA = 'dept-china';
  const user = (roles: string[], departmentId: string | null = null, id = 'u1'): AuthUser =>
    ({ id, fullName: 'Тест', email: 't@ava.local', roles, departmentId });

  it('администратор и руководитель видят все лиды', () => {
    expect(leadVisibilityWhere(user(['ADMIN']))).toEqual({});
    expect(leadVisibilityWhere(user(['DIRECTOR']))).toEqual({});
  });

  it('менеджер видит только свои лиды', () => {
    expect(leadVisibilityWhere(user(['MANAGER'], DEPT_CHINA, 'mgr'))).toEqual({
      OR: [{ responsibleId: 'mgr' }],
    });
  });

  it('руководитель отдела видит лиды своего отдела', () => {
    expect(leadVisibilityWhere(user(['DEPARTMENT_HEAD'], DEPT_CHINA, 'head'))).toEqual({
      OR: [{ departmentId: DEPT_CHINA }],
    });
  });

  it('финансист и логист лиды не видят', () => {
    expect(leadVisibilityWhere(user(['FINANCIER']))).toEqual({ id: { in: [] } });
    expect(leadVisibilityWhere(user(['LOGIST']))).toEqual({ id: { in: [] } });
  });

  it('роль без прав не видит ничего (заведомо пустое условие, а не «всё»)', () => {
    expect(leadVisibilityWhere(user([]))).toEqual({ id: { in: [] } });
  });
});
