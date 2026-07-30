import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransportationStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import {
  assertCanAssignTransportationResponsible,
  canAssignTransportationResponsible,
  canSeeTransportationClientRate,
  resolveStatusBusinessEventDate,
  resolveStatusTransition,
  TRANSPORTATION_STATUS_ORDER,
  transportationVisibilityWhere,
} from './transportation-policy';

const DEPT_CHINA = 'dept-china';
const DEPT_KZ = 'dept-kz';

function user(roles: string[], departmentId: string | null = null, id = 'u1'): AuthUser {
  return { id, fullName: 'Тест', email: 't@ava.local', roles, departmentId };
}

const {
  REQUEST_ACCEPTED, CARGO_PICKED, IN_TRANSIT, CUSTOMS, DELIVERED, CLOSED,
} = TransportationStatus;

describe('Статусы перевозки (раздел 4.3 ТЗ)', () => {
  it('содержит все шесть статусов в правильном порядке', () => {
    expect(TRANSPORTATION_STATUS_ORDER).toEqual([
      REQUEST_ACCEPTED, CARGO_PICKED, IN_TRANSIT, CUSTOMS, DELIVERED, CLOSED,
    ]);
  });

  it('разрешает переход на следующий статус и не считает его откатом', () => {
    for (let i = 0; i < TRANSPORTATION_STATUS_ORDER.length - 1; i += 1) {
      const from = TRANSPORTATION_STATUS_ORDER[i];
      const to = TRANSPORTATION_STATUS_ORDER[i + 1];
      expect(resolveStatusTransition(from, to)).toEqual({ isRollback: false });
    }
  });

  it('запрещает перепрыгивать статусы вперёд', () => {
    expect(() => resolveStatusTransition(REQUEST_ACCEPTED, IN_TRANSIT)).toThrow(BadRequestException);
    expect(() => resolveStatusTransition(REQUEST_ACCEPTED, CLOSED)).toThrow('Можно перейти только на следующий статус');
    expect(() => resolveStatusTransition(CARGO_PICKED, DELIVERED)).toThrow(BadRequestException);
  });

  it('разрешает откат назад на любое число шагов и помечает его откатом', () => {
    expect(resolveStatusTransition(IN_TRANSIT, CARGO_PICKED)).toEqual({ isRollback: true });
    expect(resolveStatusTransition(CLOSED, REQUEST_ACCEPTED)).toEqual({ isRollback: true });
    expect(resolveStatusTransition(DELIVERED, CUSTOMS)).toEqual({ isRollback: true });
  });

  it('запрещает переход в тот же самый статус', () => {
    expect(() => resolveStatusTransition(IN_TRANSIT, IN_TRANSIT)).toThrow('Перевозка уже имеет этот статус');
  });
});

describe('Дата события при смене статуса', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');

  it('требует дату для статусов «Груз забран» и «Доставлен»', () => {
    expect(() => resolveStatusBusinessEventDate(CARGO_PICKED, undefined, now))
      .toThrow('Для статуса «Груз забран» укажите дату события');
    expect(() => resolveStatusBusinessEventDate(DELIVERED, undefined, now))
      .toThrow('Для статуса «Доставлен» укажите дату события');
  });

  it('не требует дату для остальных статусов', () => {
    for (const status of [REQUEST_ACCEPTED, IN_TRANSIT, CUSTOMS, CLOSED]) {
      expect(resolveStatusBusinessEventDate(status, undefined, now)).toBeUndefined();
    }
  });

  it('не принимает дату в будущем', () => {
    expect(() => resolveStatusBusinessEventDate(CARGO_PICKED, '2026-07-31', now))
      .toThrow('Дата события не может быть в будущем');
  });

  it('не принимает некорректную дату', () => {
    expect(() => resolveStatusBusinessEventDate(CARGO_PICKED, 'не дата', now))
      .toThrow('Дата события указана неверно');
  });

  it('принимает сегодняшнюю и прошедшую дату', () => {
    expect(resolveStatusBusinessEventDate(CARGO_PICKED, '2026-07-30', now))
      .toEqual(new Date('2026-07-30T00:00:00.000Z'));
    expect(resolveStatusBusinessEventDate(DELIVERED, '2026-07-01', now))
      .toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });
});

describe('Права доступа: видимость перевозок (раздел 3 ТЗ)', () => {
  it('администратор, руководитель и финансист видят все перевозки', () => {
    for (const role of ['ADMIN', 'DIRECTOR', 'FINANCIER']) {
      expect(transportationVisibilityWhere(user([role]))).toEqual({});
    }
  });

  it('менеджер видит только перевозки по своим сделкам', () => {
    expect(transportationVisibilityWhere(user(['MANAGER'], DEPT_CHINA, 'mgr'))).toEqual({
      OR: [{ deal: { responsibleId: 'mgr' } }],
    });
  });

  it('логист видит только перевозки, где он назначен логистом', () => {
    expect(transportationVisibilityWhere(user(['LOGIST'], null, 'log'))).toEqual({
      OR: [{ logistId: 'log' }],
    });
  });

  it('руководитель отдела видит перевозки своего отдела, свои сделки и свои перевозки', () => {
    expect(transportationVisibilityWhere(user(['DEPARTMENT_HEAD'], DEPT_CHINA, 'head'))).toEqual({
      OR: [
        { deal: { departmentId: DEPT_CHINA } },
        { deal: { responsibleId: 'head' } },
        { logistId: 'head' },
      ],
    });
  });

  it('руководитель отдела без отдела не получает доступ ко всему отделу', () => {
    const where = transportationVisibilityWhere(user(['DEPARTMENT_HEAD'], null, 'head'));
    expect(where).toEqual({ OR: [{ deal: { responsibleId: 'head' } }, { logistId: 'head' }] });
  });

  it('роль без прав не видит ничего (заведомо пустое условие, а не «всё»)', () => {
    expect(transportationVisibilityWhere(user([]))).toEqual({ id: { in: [] } });
    expect(transportationVisibilityWhere(user(['UNKNOWN_ROLE']))).toEqual({ id: { in: [] } });
  });
});

describe('Права доступа: ставка клиента', () => {
  it('видна руководству, финансисту, руководителю отдела и менеджеру', () => {
    for (const role of ['ADMIN', 'DIRECTOR', 'FINANCIER', 'DEPARTMENT_HEAD', 'MANAGER']) {
      expect(canSeeTransportationClientRate(user([role]))).toBe(true);
    }
  });

  it('не видна логисту — он не должен знать заработок компании', () => {
    expect(canSeeTransportationClientRate(user(['LOGIST']))).toBe(false);
  });

  it('видна сотруднику с двойной ролью логист + менеджер', () => {
    expect(canSeeTransportationClientRate(user(['LOGIST', 'MANAGER']))).toBe(true);
  });
});

describe('Права доступа: назначение ответственного', () => {
  const candidateChina = { id: 'other', departmentId: DEPT_CHINA };
  const candidateKz = { id: 'other', departmentId: DEPT_KZ };

  it('администратор и руководитель назначают кого угодно', () => {
    for (const role of ['ADMIN', 'DIRECTOR']) {
      expect(canAssignTransportationResponsible(user([role]), candidateKz)).toBe(true);
    }
  });

  it('руководитель отдела назначает только сотрудников своего отдела', () => {
    const head = user(['DEPARTMENT_HEAD'], DEPT_CHINA, 'head');
    expect(canAssignTransportationResponsible(head, candidateChina)).toBe(true);
    expect(canAssignTransportationResponsible(head, candidateKz)).toBe(false);
  });

  it('руководитель отдела без отдела не назначает никого, кроме себя', () => {
    const head = user(['DEPARTMENT_HEAD'], null, 'head');
    expect(canAssignTransportationResponsible(head, candidateChina)).toBe(false);
  });

  it('менеджер может назначить только себя', () => {
    const manager = user(['MANAGER'], DEPT_CHINA, 'mgr');
    expect(canAssignTransportationResponsible(manager, { id: 'mgr', departmentId: DEPT_CHINA })).toBe(true);
    expect(canAssignTransportationResponsible(manager, candidateChina)).toBe(false);
  });

  it('assert-версия бросает ForbiddenException, когда прав нет', () => {
    const manager = user(['MANAGER'], DEPT_CHINA, 'mgr');
    expect(() => assertCanAssignTransportationResponsible(manager, candidateChina))
      .toThrow(ForbiddenException);
    expect(() => assertCanAssignTransportationResponsible(manager, { id: 'mgr', departmentId: DEPT_CHINA }))
      .not.toThrow();
  });
});
