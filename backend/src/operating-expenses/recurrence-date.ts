/** Возвращает заданный день следующего месяца с ограничением концом месяца. */
export function nextMonthlyDueDate(
  value: Date,
  anchorDay = value.getUTCDate(),
): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
}
