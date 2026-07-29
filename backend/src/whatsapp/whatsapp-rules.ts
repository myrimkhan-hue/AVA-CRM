/** Приводит телефон к последним 10 цифрам для сравнения — форматы ввода различаются (+7/8, пробелы, скобки). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

/** Подставляет переменные вида {{имя}} в тело шаблона; неизвестные переменные оставляет как есть. */
export function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  );
}

/**
 * Приводит телефон к формату chatId, который ожидает Wazzup (полные цифры с кодом страны, без "+").
 * Локальный 10-значный номер (без кода страны) считаем казахстанским/российским — это большинство
 * контрагентов компании; остальные форматы (например, китайские номера) оставляем как есть.
 */
export function toWhatsAppChatId(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}
