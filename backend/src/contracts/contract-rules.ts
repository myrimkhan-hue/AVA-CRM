import { ContractStatus } from '@prisma/client';

/** По умолчанию предупреждаем об истечении договора за 30 дней (раздел 4.2 ТЗ). */
export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export interface ContractDates {
  validUntil: Date | null;
  terminatedAt: Date | null;
}

/**
 * Статус договора. Расторжение задаётся вручную и перебивает всё остальное;
 * «истёк» вычисляется из даты окончания, поэтому не требует ручного обновления
 * и не может «протухнуть». Бессрочный договор (без даты окончания) действует всегда.
 */
export function resolveContractStatus(contract: ContractDates, today: Date): ContractStatus {
  if (contract.terminatedAt) return ContractStatus.TERMINATED;
  if (!contract.validUntil) return ContractStatus.ACTIVE;
  return contract.validUntil.getTime() < startOfDay(today).getTime()
    ? ContractStatus.EXPIRED
    : ContractStatus.ACTIVE;
}

/** Сколько дней осталось до окончания. null — если договор бессрочный или расторгнут. */
export function daysUntilExpiry(contract: ContractDates, today: Date): number | null {
  if (contract.terminatedAt || !contract.validUntil) return null;
  const diff = contract.validUntil.getTime() - startOfDay(today).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Нужно ли предупредить об истечении: договор действует, дата окончания
 * наступает не позже чем через warningDays, и предупреждение ещё не отправлялось.
 * Уже истёкший договор сюда не попадает — о нём предупреждать поздно.
 */
export function needsExpiryWarning(
  contract: ContractDates & { expiryNotifiedAt: Date | null },
  today: Date,
  warningDays: number = DEFAULT_EXPIRY_WARNING_DAYS,
): boolean {
  if (contract.expiryNotifiedAt) return false;
  const left = daysUntilExpiry(contract, today);
  return left !== null && left >= 0 && left <= warningDays;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
