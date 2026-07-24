import {
  buildContractNumberBase,
  buildZayavkaNumberBase,
  formatDateRu,
  formatDateShort,
  parseDateISO,
} from './format-date-ru';

describe('formatDateRu', () => {
  it('formats a date as "D month YYYY г."', () => {
    expect(formatDateRu(new Date(Date.UTC(2026, 4, 20)))).toBe('20 мая 2026 г.');
  });
});

describe('formatDateShort', () => {
  it('formats a date as DD.MM.YYYY', () => {
    expect(formatDateShort(new Date(Date.UTC(2025, 11, 24)))).toBe('24.12.2025');
  });
});

describe('parseDateISO', () => {
  it('parses YYYY-MM-DD into a UTC date', () => {
    const date = parseDateISO('2026-07-24');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(6);
    expect(date.getUTCDate()).toBe(24);
  });
});

describe('buildContractNumberBase', () => {
  it('builds PREFIX-EX-DDMM/YYYY when we are the customer', () => {
    const today = new Date(Date.UTC(2026, 6, 24));
    expect(buildContractNumberBase('TT', 'customer', today)).toBe('TT-EX-2407/2026');
  });

  it('builds PREFIX-CL-DDMM/YYYY when we are the executor', () => {
    const today = new Date(Date.UTC(2026, 6, 24));
    expect(buildContractNumberBase('AVA', 'executor', today)).toBe('AVA-CL-2407/2026');
  });
});

describe('buildZayavkaNumberBase', () => {
  it('builds PREFIX-Z-DDMM/YYYY', () => {
    const today = new Date(Date.UTC(2026, 6, 24));
    expect(buildZayavkaNumberBase('TT', today)).toBe('TT-Z-2407/2026');
  });
});
