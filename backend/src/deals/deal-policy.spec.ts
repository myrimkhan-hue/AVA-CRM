import { AuthUser } from '../auth/auth-user.type';
import { dealVisibilityWhere } from './deal-policy';

const DEPT_CHINA = 'dept-china';

function user(roles: string[], departmentId: string | null = null, id = 'u1'): AuthUser {
  return { id, fullName: 'Тест', email: 't@ava.local', roles, departmentId };
}

describe('Права доступа: видимость сделок (раздел 3 ТЗ)', () => {
  it('администратор, руководитель и финансист видят все сделки', () => {
    for (const role of ['ADMIN', 'DIRECTOR', 'FINANCIER']) {
      expect(dealVisibilityWhere(user([role]))).toEqual({});
    }
  });

  it('менеджер видит только свои сделки', () => {
    expect(dealVisibilityWhere(user(['MANAGER'], DEPT_CHINA, 'mgr'))).toEqual({
      OR: [{ responsibleId: 'mgr' }],
    });
  });

  it('руководитель отдела видит сделки своего отдела и свои', () => {
    expect(dealVisibilityWhere(user(['DEPARTMENT_HEAD'], DEPT_CHINA, 'head'))).toEqual({
      OR: [{ departmentId: DEPT_CHINA }, { responsibleId: 'head' }],
    });
  });

  it('руководитель отдела без отдела видит только свои сделки', () => {
    expect(dealVisibilityWhere(user(['DEPARTMENT_HEAD'], null, 'head'))).toEqual({
      OR: [{ responsibleId: 'head' }],
    });
  });

  it('логист сделок не видит', () => {
    expect(dealVisibilityWhere(user(['LOGIST'], null, 'log'))).toEqual({ id: { in: [] } });
  });

  it('роль без прав не видит ничего (заведомо пустое условие, а не «всё»)', () => {
    expect(dealVisibilityWhere(user([]))).toEqual({ id: { in: [] } });
  });

  it('двойная роль логист + менеджер даёт доступ к своим сделкам', () => {
    expect(dealVisibilityWhere(user(['LOGIST', 'MANAGER'], null, 'both'))).toEqual({
      OR: [{ responsibleId: 'both' }],
    });
  });
});
