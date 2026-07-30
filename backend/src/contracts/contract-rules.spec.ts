import { ContractStatus } from '@prisma/client';
import {
  daysUntilExpiry,
  DEFAULT_EXPIRY_WARNING_DAYS,
  needsExpiryWarning,
  resolveContractStatus,
} from './contract-rules';

const today = new Date('2026-07-30T14:30:00.000Z');
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('Статус договора (раздел 4.2 ТЗ)', () => {
  it('действует, пока дата окончания не прошла', () => {
    expect(resolveContractStatus({ validUntil: d('2026-12-31'), terminatedAt: null }, today))
      .toBe(ContractStatus.ACTIVE);
  });

  it('договор без даты окончания считается бессрочным и действует', () => {
    expect(resolveContractStatus({ validUntil: null, terminatedAt: null }, today))
      .toBe(ContractStatus.ACTIVE);
  });

  it('истёк, если дата окончания уже прошла', () => {
    expect(resolveContractStatus({ validUntil: d('2026-07-29'), terminatedAt: null }, today))
      .toBe(ContractStatus.EXPIRED);
  });

  it('в последний день действия ещё действует, а не истёк', () => {
    expect(resolveContractStatus({ validUntil: d('2026-07-30'), terminatedAt: null }, today))
      .toBe(ContractStatus.ACTIVE);
  });

  it('расторжение перебивает всё остальное', () => {
    expect(resolveContractStatus({ validUntil: d('2026-12-31'), terminatedAt: d('2026-07-01') }, today))
      .toBe(ContractStatus.TERMINATED);
    expect(resolveContractStatus({ validUntil: null, terminatedAt: d('2026-07-01') }, today))
      .toBe(ContractStatus.TERMINATED);
  });
});

describe('daysUntilExpiry', () => {
  it('считает дни до окончания, не обращая внимания на время суток', () => {
    expect(daysUntilExpiry({ validUntil: d('2026-08-09'), terminatedAt: null }, today)).toBe(10);
    expect(daysUntilExpiry({ validUntil: d('2026-07-30'), terminatedAt: null }, today)).toBe(0);
  });

  it('отрицательное число для уже истёкшего', () => {
    expect(daysUntilExpiry({ validUntil: d('2026-07-25'), terminatedAt: null }, today)).toBe(-5);
  });

  it('null для бессрочного и расторгнутого', () => {
    expect(daysUntilExpiry({ validUntil: null, terminatedAt: null }, today)).toBeNull();
    expect(daysUntilExpiry({ validUntil: d('2026-08-09'), terminatedAt: d('2026-07-01') }, today)).toBeNull();
  });
});

describe('Предупреждение об истечении договора', () => {
  const base = { terminatedAt: null, expiryNotifiedAt: null };

  it('по умолчанию предупреждает за 30 дней', () => {
    expect(DEFAULT_EXPIRY_WARNING_DAYS).toBe(30);
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-08-20') }, today)).toBe(true);
  });

  it('не предупреждает, если до окончания больше срока предупреждения', () => {
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-09-30') }, today)).toBe(false);
  });

  it('предупреждает ровно на границе срока', () => {
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-08-29') }, today)).toBe(true);
  });

  it('не предупреждает повторно, если уже предупреждали', () => {
    expect(needsExpiryWarning(
      { ...base, validUntil: d('2026-08-20'), expiryNotifiedAt: d('2026-07-25') },
      today,
    )).toBe(false);
  });

  it('не предупреждает об уже истёкшем — поздно', () => {
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-07-20') }, today)).toBe(false);
  });

  it('не предупреждает о бессрочном и расторгнутом', () => {
    expect(needsExpiryWarning({ ...base, validUntil: null }, today)).toBe(false);
    expect(needsExpiryWarning(
      { validUntil: d('2026-08-05'), terminatedAt: d('2026-07-01'), expiryNotifiedAt: null },
      today,
    )).toBe(false);
  });

  it('учитывает настроенный срок предупреждения, а не только 30 дней', () => {
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-08-20') }, today, 7)).toBe(false);
    expect(needsExpiryWarning({ ...base, validUntil: d('2026-08-03') }, today, 7)).toBe(true);
  });
});
