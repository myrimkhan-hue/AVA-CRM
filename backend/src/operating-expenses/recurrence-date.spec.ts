import { nextMonthlyDueDate } from './recurrence-date';

describe('nextMonthlyDueDate', () => {
  it.each([
    ['2025-01-31', '2025-02-28'],
    ['2024-01-31', '2024-02-29'],
    ['2026-11-30', '2026-12-30'],
  ])('переносит %s на %s', (source, expected) => {
    const input = new Date(`${source}T00:00:00.000Z`);
    expect(nextMonthlyDueDate(input).toISOString().slice(0, 10)).toBe(expected);
    expect(input.toISOString().slice(0, 10)).toBe(source);
  });

  it('сохраняет исходный день после короткого месяца', () => {
    const february = nextMonthlyDueDate(new Date('2025-01-31T00:00:00.000Z'));
    const march = nextMonthlyDueDate(february, 31);
    expect(february.toISOString().slice(0, 10)).toBe('2025-02-28');
    expect(march.toISOString().slice(0, 10)).toBe('2025-03-31');
  });
});
