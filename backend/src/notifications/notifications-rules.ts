import { TransportationStatus } from '@prisma/client';

const FINAL_TRANSPORTATION_STATUSES = new Set<TransportationStatus>([
  TransportationStatus.DELIVERED,
  TransportationStatus.CLOSED,
]);

/** Перевозка считается просроченной, если план доставки уже прошёл, а статус ещё не финальный. */
export function isTransportationOverdue(
  status: TransportationStatus,
  plannedDeliveryDate: Date | null,
  today: Date,
): boolean {
  if (!plannedDeliveryDate) return false;
  if (FINAL_TRANSPORTATION_STATUSES.has(status)) return false;
  return plannedDeliveryDate.getTime() < today.getTime();
}

/** Сделка "зависла", если с последнего изменения стадии прошло не меньше thresholdDays суток. */
export function isDealStalled(sinceDate: Date, today: Date, thresholdDays: number): boolean {
  const cutoff = today.getTime() - thresholdDays * 24 * 60 * 60 * 1000;
  return sinceDate.getTime() <= cutoff;
}
