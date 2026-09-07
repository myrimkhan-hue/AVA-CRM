/**
 * Даты бизнес-событий (оплата, погрузка, выгрузка) сотрудник вводит как
 * календарное число своего дня: «8 сентября». В базу они приходят строкой
 * «ГГГГ-ММ-ДД» и разбираются как полночь UTC.
 *
 * Сервер при этом работает по UTC, а компания — по Алматы (UTC+5). Из-за этого
 * наивное сравнение «дата события позже, чем сейчас» ломалось каждую ночь:
 * с полуночи до пяти утра по местному времени сервер считал, что сегодня ещё
 * вчера, и отвергал сегодняшнюю дату как «будущую». Логист, отметивший погрузку
 * в четыре утра, получал отказ без единой причины на экране.
 *
 * Поэтому сравниваем не моменты времени, а календарные дни в поясе компании.
 * Пояс вынесен в переменную окружения: если компания откроет офис в другом
 * часовом поясе, это настройка, а не правка кода.
 */
const COMPANY_TIME_ZONE = process.env.COMPANY_TIME_ZONE?.trim() || 'Asia/Almaty';

/** Календарный день как число ГГГГММДД — в таком виде дни удобно сравнивать. */
function dayNumber(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

/** Сегодняшний календарный день в часовом поясе компании. */
export function companyToday(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return dayNumber(get('year'), get('month'), get('day'));
}

/**
 * Календарный день введённой даты. Дата хранится как полночь UTC, поэтому
 * читаем именно UTC-составляющие: иначе на сервере западнее Гринвича число
 * съезжало бы на день назад.
 */
export function calendarDay(date: Date): number {
  return dayNumber(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** Дата относится к будущему дню по календарю компании. */
export function isFutureBusinessDay(date: Date, now: Date = new Date()): boolean {
  return calendarDay(date) > companyToday(now);
}
