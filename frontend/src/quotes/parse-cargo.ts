// Разбор произвольного текста заявки (обычно — сообщение клиента из WhatsApp)
// на поля просчёта. Сделано по образцу documents/parse-requisites.ts: без ИИ,
// на образцах и словарях, поэтому работает мгновенно, без интернета и одинаково.
//
// ГЛАВНОЕ ПРАВИЛО: лучше не распознать, чем распознать неверно. Молча
// подставленный не тот вес уйдёт в ставку и всплывёт уже на перевозке, когда
// исправлять дорого. Поэтому каждое число берётся только вместе с единицей
// измерения или ключевым словом рядом; голое число не попадает никуда.
//
// ВАЖНО ПРО РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ И КИРИЛЛИЦУ: в JavaScript \w — это только
// [A-Za-z0-9_], а \b считает границы слов по тем же латинским буквам. На русском
// тексте они молча не срабатывают: «готов\w*» не поймает «готовность», а «\bреф\b»
// не найдёт «реф». Поэтому ниже вместо них — RU_TAIL (окончание русского слова)
// и пара RU_START / RU_END (границы слова с учётом кириллицы). Не заменяйте их
// обратно на \w и \b: ошибка будет тихой, разбор просто перестанет находить поля.

import { DELIVERY_TERMS, type DeliveryTerms, type QuoteCurrency } from './shared';

export interface ParsedCargo {
  originPoint?: string;
  destinationPoint?: string;
  cargoName?: string;
  weightKg?: number;
  volumeM3?: number;
  placesCount?: number;
  placesUnit?: string;
  vehicleType?: string;
  deliveryTerms?: DeliveryTerms;
  isDangerous?: boolean;
  cargoReadyDate?: string;
  clientTargetRate?: number;
  clientTargetRateCurrency?: QuoteCurrency;
}

/** Порядок полей в отчёте «распознано / не найдено» — совпадает с порядком блоков формы. */
export const PARSED_CARGO_KEYS = [
  'originPoint', 'destinationPoint', 'cargoName', 'weightKg', 'volumeM3',
  'placesCount', 'vehicleType', 'deliveryTerms', 'isDangerous', 'cargoReadyDate',
  'clientTargetRate',
] as const;

const RU_TAIL = '[а-яё]*';
const RU_START = '(?:^|[^0-9A-Za-zА-Яа-яЁё])';
const RU_END = '(?=$|[^0-9A-Za-zА-Яа-яЁё])';
const NUM = '(\\d[\\d\\s\\u00A0]*(?:[.,]\\d+)?)';

/** Типы кузова и контейнеров. Длинные формы раньше коротких: «рефрижератор» до «реф». */
const VEHICLE_TYPES: [RegExp, string][] = [
  [new RegExp(`рефрижератор${RU_TAIL}`, 'i'), 'рефрижератор'],
  [new RegExp(`${RU_START}реф${RU_END}`, 'i'), 'реф'],
  [new RegExp(`изотерм${RU_TAIL}`, 'i'), 'изотерм'],
  [new RegExp(`бортов${RU_TAIL}|${RU_START}борт${RU_END}`, 'i'), 'борт'],
  [new RegExp(`платформ${RU_TAIL}`, 'i'), 'платформа'],
  [new RegExp(`${RU_START}трал${RU_END}`, 'i'), 'трал'],
  [new RegExp(`автовоз${RU_TAIL}`, 'i'), 'автовоз'],
  [new RegExp(`цистерн${RU_TAIL}`, 'i'), 'цистерна'],
  [new RegExp(`тент${RU_TAIL}`, 'i'), 'тент'],
  [/\b(20|40|45)\s?(DC|HC|HQ|RF|OT)\b/i, ''],
  [new RegExp(`контейнер${RU_TAIL}`, 'i'), 'контейнер'],
];

const MONTHS = [
  'январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн', 'июл',
  'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
];

/** Слова, которые не могут быть названием города: защита от «груз - текстиль». */
const NOT_A_PLACE = new RegExp(
  `^(груз${RU_TAIL}|товар${RU_TAIL}|наименовани${RU_TAIL}|ставк${RU_TAIL}|бюджет${RU_TAIL}|` +
  `цен${RU_TAIL}|вес${RU_TAIL}|об[ъь][её]м${RU_TAIL}|мест${RU_TAIL}|паллет${RU_TAIL}|` +
  `тип${RU_TAIL}|готовност${RU_TAIL}|срок${RU_TAIL}|коммента${RU_TAIL}|примечани${RU_TAIL})$`,
  'i',
);

/**
 * Составные названия через дефис, которые НЕ являются маршрутом.
 * Без этого «Усть-Каменогорск» превратился бы в маршрут «Усть → Каменогорск».
 */
const HYPHEN_PLACE_PREFIX = /^(усть|петро|северо|южно|восточно|западно|ново|старо|верхне|нижне|улан|ростов|санкт|нур|алма|кызыл|темир|каскелен)$/i;

/** Число может быть записано как «25 219», «3 800 000», «2,8» или «2.8». */
function toNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Убирает уже разобранный кусок текста, чтобы следующие образцы не поймали его повторно. */
function consume(text: string, fragment: string): string {
  const at = text.indexOf(fragment);
  return at < 0 ? text : text.slice(0, at) + ' '.repeat(fragment.length) + text.slice(at + fragment.length);
}

function parsePlace(value: string): string | undefined {
  const place = value.trim().replace(/^[«"'(]+|[»"').,;:!?]+$/g, '').trim();
  if (place.length < 2 || place.length > 40) return undefined;
  if (/\d/.test(place)) return undefined;
  if (NOT_A_PLACE.test(place)) return undefined;
  return place;
}

/** Направление: «из X в Y», «X — Y», «X→Y», «Sanmen-Khorgos». */
function parseRoute(text: string): { from: string; to: string } | undefined {
  const explicit = text.match(/(?:^|\s)из\s+([^\n,;]{2,40}?)\s+в\s+([^\n,;.]{2,40})/i);
  if (explicit) {
    const from = parsePlace(explicit[1]);
    const to = parsePlace(explicit[2]);
    if (from && to) return { from, to };
  }
  // Разбираем по сегментам: маршрут почти всегда стоит в своей части сообщения.
  const segments = text.split(/[\n,;]|\.\s/);
  for (const segment of segments) {
    const spaced = segment.match(/([^\n,;]{2,40}?)\s*(?:[—–]|->|→|\s-\s)\s*([^\n,;]{2,40})/);
    if (!spaced) continue;
    const from = parsePlace(spaced[1]);
    const to = parsePlace(spaced[2]);
    if (from && to) return { from, to };
  }
  for (const segment of segments) {
    const tight = segment.match(/(?:^|\s)([A-Za-zА-Яа-яЁё]{3,25})-([A-Za-zА-Яа-яЁё]{3,25})(?=$|[\s,;.])/);
    if (!tight || HYPHEN_PLACE_PREFIX.test(tight[1])) continue;
    const from = parsePlace(tight[1]);
    const to = parsePlace(tight[2]);
    if (from && to) return { from, to };
  }
  return undefined;
}

function nearestYear(month: number, day: number, today: Date): number {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const candidate = new Date(today.getFullYear(), month - 1, day);
  return candidate < startOfToday ? today.getFullYear() + 1 : today.getFullYear();
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Дата готовности. Год подставляется ближайший не прошедший, если он не указан. */
function parseReadyDate(text: string, today: Date): { value: string; matched: string } | undefined {
  const prefix = `готов${RU_TAIL}\\s*(?:к\\s+|до\\s+)?`;
  const numeric = text.match(new RegExp(`${prefix}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?`, 'i'));
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const raw = numeric[3];
      const year = raw ? Number(raw.length === 2 ? `20${raw}` : raw) : nearestYear(month, day, today);
      return { value: iso(year, month, day), matched: numeric[0] };
    }
  }
  const worded = text.match(new RegExp(`${prefix}(\\d{1,2})\\s+(${MONTHS.join('|')})${RU_TAIL}`, 'i'));
  if (worded) {
    const day = Number(worded[1]);
    const month = MONTHS.findIndex((m) => new RegExp(`^${m}`, 'i').test(worded[2])) + 1;
    if (day >= 1 && day <= 31 && month >= 1) {
      return { value: iso(nearestYear(month, day, today), month, day), matched: worded[0] };
    }
  }
  return undefined;
}

/** Ставка берётся только вместе с валютой: сумма без валюты хуже, чем её отсутствие. */
function parseRate(text: string): { value: number; currency: QuoteCurrency; matched: string } | undefined {
  const currency = `(\\$|USD|долл${RU_TAIL}|тенге|тг${RU_END}|KZT|₸)`;
  const keyword = `(?:ставк${RU_TAIL}|бюджет${RU_TAIL}|цен${RU_TAIL}|да[ёе]т|до)\\s*[:\\-–]?\\s*`;
  const found = text.match(new RegExp(`${keyword}${NUM}\\s*${currency}`, 'i'))
    ?? text.match(new RegExp(`${NUM}\\s*${currency}`, 'i'));
  if (!found) return undefined;
  const value = toNumber(found[1]);
  if (value === undefined) return undefined;
  return {
    value,
    currency: /тенге|тг|kzt|₸/i.test(found[2]) ? 'KZT' : 'USD',
    matched: found[0],
  };
}

export function parseCargoText(rawText: string, today: Date = new Date()): ParsedCargo {
  const out: ParsedCargo = {};
  let t = ` ${String(rawText || '').replace(/ /g, ' ')} `;

  // Дата разбирается первой: иначе «15.09» рискует попасть в числовые поля.
  const ready = parseReadyDate(t, today);
  if (ready) { out.cargoReadyDate = ready.value; t = consume(t, ready.matched); }

  const rate = parseRate(t);
  if (rate) {
    out.clientTargetRate = rate.value;
    out.clientTargetRateCurrency = rate.currency;
    t = consume(t, rate.matched);
  }

  const weightUnits = `(тонн${RU_TAIL}|тн${RU_END}|т${RU_END}|кг${RU_END}|kgs?\\b)`;
  const weight = t.match(new RegExp(`${NUM}\\s*${weightUnits}`, 'i'))
    ?? t.match(new RegExp(`вес${RU_TAIL}\\s*[:\\-–]?\\s*${NUM}`, 'i'));
  if (weight) {
    const value = toNumber(weight[1]);
    if (value !== undefined) {
      const inTons = weight[2] ? /^(тонн|тн|т)$/i.test(weight[2].trim()) : false;
      out.weightKg = inTons ? value * 1000 : value;
      t = consume(t, weight[0]);
    }
  }

  const volume = t.match(new RegExp(`${NUM}\\s*(куб${RU_TAIL}|м3|м³|m3|cbm)`, 'i'))
    ?? t.match(new RegExp(`об[ъь][её]м${RU_TAIL}\\s*[:\\-–]?\\s*${NUM}`, 'i'));
  if (volume) {
    const value = toNumber(volume[1]);
    if (value !== undefined) { out.volumeM3 = value; t = consume(t, volume[0]); }
  }

  const placeUnits = `(паллет${RU_TAIL}|палет${RU_TAIL}|пал${RU_END}|мест${RU_TAIL}|коробо?к${RU_TAIL}|ящик${RU_TAIL})`;
  const places = t.match(new RegExp(`${NUM}\\s*${placeUnits}`, 'i'));
  if (places) {
    const value = toNumber(places[1]);
    if (value !== undefined && Number.isInteger(value)) {
      const unit = places[2];
      out.placesCount = value;
      out.placesUnit = /паллет|палет|пал/i.test(unit) ? 'паллет'
        : /коробо/i.test(unit) ? 'коробок'
        : /ящик/i.test(unit) ? 'ящиков' : 'мест';
      t = consume(t, places[0]);
    }
  }

  const terms = t.match(new RegExp(`\\b(${DELIVERY_TERMS.join('|')})\\b`, 'i'));
  if (terms) out.deliveryTerms = terms[1].toUpperCase() as DeliveryTerms;

  for (const [pattern, canonical] of VEHICLE_TYPES) {
    const match = t.match(pattern);
    if (!match) continue;
    out.vehicleType = canonical || match[0].replace(/\s+/g, '').toUpperCase();
    break;
  }

  // Отрицание проверяется первым и побеждает: «не ADR» — это ложь, а не истина.
  const noAdr = new RegExp(`${RU_START}(?:не|без)\\s*(?:adr|адр)${RU_END}|неопасн${RU_TAIL}`, 'i');
  const yesAdr = new RegExp(
    `${RU_START}adr${RU_END}|${RU_START}адр${RU_END}|опасн${RU_TAIL}\\s+груз|класс\\s*[1-9](?!\\d)`, 'i',
  );
  if (noAdr.test(t)) out.isDangerous = false;
  else if (yesAdr.test(t)) out.isDangerous = true;

  // Название груза разбирается последним: это самый «жадный» образец, и до
  // обрезки по стоп-словам он утаскивал в название хвост вроде «не ADR».
  const cargo = t.match(new RegExp(
    `(?:наименовани${RU_TAIL}(?:\\s+груза)?|груз|товар)\\s*[:\\-–—]\\s*([^\\n,;.]{2,80})`, 'i',
  ));
  if (cargo) {
    const name = trimCargoName(cargo[1]);
    if (name && !/^\d+$/.test(name)) { out.cargoName = name; t = consume(t, cargo[0]); }
  }

  const route = parseRoute(t);
  if (route) { out.originPoint = route.from; out.destinationPoint = route.to; }

  return out;
}

/** Обрезает название груза перед соседним признаком: «продукты питания не ADR» → «продукты питания». */
function trimCargoName(raw: string): string {
  const stop = new RegExp(
    `\\s+(?:(?:не|без)\\s+)?(?:adr|адр)${RU_END}` +
    `|\\s+(?:готов${RU_TAIL}|ставк${RU_TAIL}|бюджет${RU_TAIL}|вес${RU_TAIL}|об[ъь][её]м${RU_TAIL})` +
    `|\\s+(?:${DELIVERY_TERMS.join('|')})\\b` +
    `|\\s+(?:тент|реф|рефрижератор|изотерм|контейнер|платформ|автовоз|цистерн|трал)${RU_TAIL}${RU_END}`,
    'i',
  );
  const cut = raw.search(stop);
  const name = (cut > 0 ? raw.slice(0, cut) : raw).trim().replace(/[.;:,\-–—]+$/, '').trim();
  return name;
}
