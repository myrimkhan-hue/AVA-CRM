// Порт formatDateRu/generateContractNumber/generateZayavkaNumber из
// contract-generator (php/lib/helpers.php), логика не менялась.

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** "20 мая 2026 г." из даты. */
export function formatDateRu(date: Date = new Date()): string {
  const day = date.getUTCDate();
  const month = RU_MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year} г.`;
}

/** "24.12.2025" из даты. */
export function formatDateShort(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Разбор "YYYY-MM-DD" в Date (UTC, полдень — без смещения по TZ при выводе даты). */
export function parseDateISO(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function ddmm(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

/** Номер договора: <ПРЕФИКС>-EX|CL-DDMM/YYYY (EX — мы заказчик, CL — мы исполнитель) */
export function buildContractNumberBase(prefix: string, ourRole: 'customer' | 'executor', today: Date = new Date()): string {
  const roleCode = ourRole === 'customer' ? 'EX' : 'CL';
  return `${prefix}-${roleCode}-${ddmm(today)}/${today.getUTCFullYear()}`;
}

/** Номер заявки: <ПРЕФИКС>-Z-DDMM/YYYY */
export function buildZayavkaNumberBase(prefix: string, today: Date = new Date()): string {
  return `${prefix}-Z-${ddmm(today)}/${today.getUTCFullYear()}`;
}
