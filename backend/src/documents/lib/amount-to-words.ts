// Порт amountToWords из contract-generator (php/lib/helpers.php), логика не менялась.

const ONES_MASCULINE = [
  '', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const ONES_FEMININE = [
  '', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
  'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

function pluralForm(num: number, one: string, two: string, five: string): string {
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 19) return five;
  const mod10 = num % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

function chunkToWords(num: number, feminine = false): string {
  if (num === 0) return '';
  const ones = feminine ? ONES_FEMININE : ONES_MASCULINE;
  let result = '';
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  if (hundreds) result += `${HUNDREDS[hundreds]} `;
  if (rest < 20 && rest > 0) {
    result += `${ones[rest]} `;
  } else if (rest >= 20) {
    result += `${TENS[Math.floor(rest / 10)]} `;
    if (rest % 10) result += `${ones[rest % 10]} `;
  }
  return result;
}

/** Сумма прописью (тенге, целое число). */
export function amountToWords(value: number): string {
  const n = Math.trunc(value);
  if (n === 0) return 'ноль';

  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  let result = '';
  if (millions) {
    result += chunkToWords(millions) + pluralForm(millions, 'миллион', 'миллиона', 'миллионов') + ' ';
  }
  if (thousands) {
    result += chunkToWords(thousands, true) + pluralForm(thousands, 'тысяча', 'тысячи', 'тысяч') + ' ';
  }
  if (remainder) {
    result += chunkToWords(remainder);
  }
  return result.trim();
}

/** Сумма цифрами с разделителями пробелом: 1000000 -> "1 000 000" */
export function formatAmount(value: number): string {
  const n = Math.trunc(value);
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
