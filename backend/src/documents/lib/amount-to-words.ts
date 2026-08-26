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

/** Сумма цифрами с разделителями пробелом, без копеек: 1000000 -> "1 000 000" */
export function formatAmount(value: number): string {
  const n = Math.trunc(value);
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Денежная сумма для документов: всегда две цифры после запятой — "630 000,00",
 * "23 448,28". В отличие от formatAmount копейки не отбрасываются: в счёте и акте
 * они попадают в итог и в сумму НДС, а расхождение с ними на стороне клиента —
 * это расхождение платежа.
 */
export function formatMoney(value: number): string {
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const whole = Math.trunc(rounded);
  const cents = Math.round((rounded - whole) * 100);
  const sign = value < 0 ? '-' : '';
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${wholeText},${String(cents).padStart(2, '0')}`;
}

/**
 * "Шестьсот тридцать тысяч тенге 00 тиын" — сумма прописью с тиынами (только для KZT).
 * Написание валюты задаётся вызывающим: в счёте по образцу владельца используется
 * казахское «теңге», в остальных документах — русское «тенге».
 */
export function amountToWordsWithTiyin(value: number, currencyWord = 'тенге'): string {
  const whole = Math.trunc(value);
  const tiyin = Math.round((Math.abs(value) - Math.abs(whole)) * 100);
  return `${amountToWords(whole)} ${currencyWord} ${String(tiyin).padStart(2, '0')} тиын`;
}
