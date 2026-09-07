import { calendarDay, companyToday, isFutureBusinessDay } from './business-date';

/**
 * Ошибка, ради которой написаны эти тесты: сервер работает по UTC, компания —
 * по Алматы (UTC+5). С полуночи до пяти утра по местному времени сервер считал,
 * что сегодня ещё вчера, и отвергал сегодняшнюю дату погрузки или оплаты как
 * «будущую». Логист, отметивший погрузку в четыре утра, получал отказ.
 */
describe('Календарные дни в часовом поясе компании', () => {
  // 8 сентября 2026, 01:00 по Алматы — это ещё 7 сентября 19:00 по UTC.
  const nightInAlmaty = new Date('2026-09-07T20:00:00.000Z');
  const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

  it('в ночь по местному времени сегодняшний день — уже наступивший', () => {
    expect(companyToday(nightInAlmaty)).toBe(20260908);
  });

  it('сегодняшняя дата не считается будущей, даже когда по UTC ещё вчера', () => {
    expect(isFutureBusinessDay(day('2026-09-08'), nightInAlmaty)).toBe(false);
  });

  it('завтрашняя дата всё равно отвергается', () => {
    expect(isFutureBusinessDay(day('2026-09-09'), nightInAlmaty)).toBe(true);
  });

  it('прошедшие даты принимаются', () => {
    expect(isFutureBusinessDay(day('2026-09-01'), nightInAlmaty)).toBe(false);
    expect(isFutureBusinessDay(day('2020-01-01'), nightInAlmaty)).toBe(false);
  });

  it('днём поведение прежнее', () => {
    const noon = new Date('2026-09-08T09:00:00.000Z');
    expect(isFutureBusinessDay(day('2026-09-08'), noon)).toBe(false);
    expect(isFutureBusinessDay(day('2026-09-09'), noon)).toBe(true);
  });

  it('день даты читается из UTC-составляющих, а не из локальных', () => {
    expect(calendarDay(day('2026-01-31'))).toBe(20260131);
    expect(calendarDay(day('2026-12-31'))).toBe(20261231);
  });

  it('переход через год и месяц не сбивает сравнение', () => {
    const newYearNight = new Date('2025-12-31T20:00:00.000Z');
    expect(companyToday(newYearNight)).toBe(20260101);
    expect(isFutureBusinessDay(day('2026-01-01'), newYearNight)).toBe(false);
    expect(isFutureBusinessDay(day('2026-01-02'), newYearNight)).toBe(true);
  });
});
