import { amountToWords, amountToWordsWithTiyin, formatAmount } from './amount-to-words';

describe('amountToWords', () => {
  it.each([
    [0, 'ноль'],
    [1, 'один'],
    [15, 'пятнадцать'],
    [21, 'двадцать один'],
    [100, 'сто'],
    [1000, 'одна тысяча'],
    [2000, 'две тысячи'],
    [5000, 'пять тысяч'],
    [15000, 'пятнадцать тысяч'],
    [21000, 'двадцать одна тысяча'],
    [1000000, 'один миллион'],
    [1234567, 'один миллион двести тридцать четыре тысячи пятьсот шестьдесят семь'],
  ])('%i -> %s', (value, expected) => {
    expect(amountToWords(value)).toBe(expected);
  });
});

describe('amountToWordsWithTiyin', () => {
  it('appends "тенге NN тиын"', () => {
    expect(amountToWordsWithTiyin(630000)).toBe('шестьсот тридцать тысяч тенге 00 тиын');
    expect(amountToWordsWithTiyin(1234.5)).toBe('одна тысяча двести тридцать четыре тенге 50 тиын');
  });
});

describe('formatAmount', () => {
  it.each([
    [0, '0'],
    [1000, '1 000'],
    [1234567, '1 234 567'],
  ])('%i -> %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected);
  });
});
