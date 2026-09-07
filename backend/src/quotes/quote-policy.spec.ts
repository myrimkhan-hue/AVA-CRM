import { AuthUser } from '../auth/auth-user.type';
import {
  assertCanEditQuoteClientRate,
  canSeeQuoteClientRate,
  presentQuote,
  quoteVisibilityWhere,
} from './quote-policy';

const user = (roles: string[], id = 'u1'): AuthUser => ({
  id,
  roles,
  departmentId: null,
  fullName: 'Тест',
  email: 'test@ava.local',
});

describe('Права доступа к просчётам', () => {
  it('добавление роли логиста не ограничивает администратора общей очередью', () =>
    expect(quoteVisibilityWhere(user(['ADMIN', 'LOGIST']))).toEqual({}));
  it('менеджер видит только свои просчёты', () =>
    expect(quoteVisibilityWhere(user(['MANAGER'], 'manager'))).toEqual({
      OR: [{ deal: { responsibleId: 'manager' } }],
    }));
  it('логист без отдела видит свои и свободные просчёты без отдела', () =>
    expect(quoteVisibilityWhere(user(['LOGIST'], 'logist'))).toEqual({
      OR: [
        { OR: [{ logistId: 'logist' }] },
        { logistId: null, deal: { OR: [{ departmentId: null }] } },
      ],
    }));
  it('права комбинированных ролей суммируются', () =>
    expect(quoteVisibilityWhere(user(['LOGIST', 'MANAGER'], 'both'))).toEqual({
      OR: [
        { OR: [{ deal: { responsibleId: 'both' } }, { logistId: 'both' }] },
        { logistId: null, deal: { OR: [{ departmentId: null }] } },
      ],
    }));
  it('чистый логист не видит ставку клиенту, но видит ориентир и себестоимость', () => {
    const result = presentQuote(
      {
        clientRate: null,
        clientRateCurrency: null,
        deal: {
          clientTargetRate: '100',
          departmentId: null,
          responsibleId: 'manager',
        },
        quoteOptions: [
          { costRate: '80', clientRate: '110', clientRateCurrency: 'USD' },
        ],
      },
      user(['LOGIST']),
    );
    expect(canSeeQuoteClientRate(user(['LOGIST']))).toBe(false);
    expect(result.deal).toHaveProperty('clientTargetRate');
    expect(result).not.toHaveProperty('clientRate');
    expect(result).not.toHaveProperty('clientRateCurrency');
    expect(result.quoteOptions[0]).toHaveProperty('costRate');
    expect(result.quoteOptions[0]).not.toHaveProperty('clientRate');
    expect(result.quoteOptions[0]).not.toHaveProperty('clientRateCurrency');
  });
  it('логист с ролью менеджера видит ставку клиенту', () =>
    expect(canSeeQuoteClientRate(user(['LOGIST', 'MANAGER']))).toBe(true));
  it('менеджер не видит ставку клиента в чужом просчёте', () => {
    const result = presentQuote(
      {
        clientRate: '120',
        clientRateCurrency: 'USD',
        deal: {
          clientTargetRate: '100',
          departmentId: null,
          responsibleId: 'other-manager',
        },
        quoteOptions: [
          { costRate: '80', clientRate: '120', clientRateCurrency: 'USD' },
        ],
      },
      user(['MANAGER'], 'manager'),
    );

    expect(result).not.toHaveProperty('clientRate');
    expect(result).not.toHaveProperty('clientRateCurrency');
    expect(result.quoteOptions[0]).not.toHaveProperty('clientRate');
    expect(result.quoteOptions[0]).not.toHaveProperty('clientRateCurrency');
  });
  it('чистый логист не может записать ставку или её валюту', () => {
    expect(() =>
      assertCanEditQuoteClientRate(user(['LOGIST']), { clientRate: 100 }),
    ).toThrow('Логист не может изменять ставку клиенту');
    expect(() =>
      assertCanEditQuoteClientRate(user(['LOGIST']), {
        clientRateCurrency: 'USD',
      }),
    ).toThrow();
  });
  it('логист с ролью менеджера может записать ставку клиенту', () => {
    expect(() =>
      assertCanEditQuoteClientRate(user(['LOGIST', 'MANAGER']), {
        clientRate: 100,
      }),
    ).not.toThrow();
  });
});
