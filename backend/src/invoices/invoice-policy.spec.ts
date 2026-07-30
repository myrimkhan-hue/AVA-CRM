import { AuthUser } from '../auth/auth-user.type';
import { invoiceVisibilityWhere } from './invoice-policy';

const DEPT_CHINA = 'dept-china';

function user(roles: string[], departmentId: string | null = null, id = 'u1'): AuthUser {
  return { id, fullName: 'Тест', email: 't@ava.local', roles, departmentId };
}

describe('Права доступа: видимость счетов (раздел 3 ТЗ)', () => {
  it('администратор, руководитель и финансист видят все счета', () => {
    for (const role of ['ADMIN', 'DIRECTOR', 'FINANCIER']) {
      expect(invoiceVisibilityWhere(user([role]))).toEqual({});
    }
  });

  it('менеджер видит счета только по своим сделкам', () => {
    expect(invoiceVisibilityWhere(user(['MANAGER'], DEPT_CHINA, 'mgr'))).toEqual({
      transportation: { is: { OR: [{ deal: { responsibleId: 'mgr' } }] } },
    });
  });

  it('руководитель отдела видит счета своего отдела', () => {
    expect(invoiceVisibilityWhere(user(['DEPARTMENT_HEAD'], DEPT_CHINA, 'head'))).toEqual({
      transportation: { is: { OR: [{ deal: { departmentId: DEPT_CHINA } }] } },
    });
  });

  it('логист счета не видит — в отличие от заявок на оплату по своим перевозкам', () => {
    expect(invoiceVisibilityWhere(user(['LOGIST'], null, 'log'))).toEqual({ id: { in: [] } });
  });

  it('роль без прав не видит ничего (заведомо пустое условие, а не «всё»)', () => {
    expect(invoiceVisibilityWhere(user([]))).toEqual({ id: { in: [] } });
  });
});
