import { describe, expect, it } from 'vitest';
import { parseCargoText } from './parse-cargo';

// Дата фиксируется, иначе тесты на «ближайший год» ломались бы каждый январь.
const TODAY = new Date(2026, 8, 4);
const parse = (text: string) => parseCargoText(text, TODAY);

describe('Разбор текста заявки на поля просчёта', () => {
  it('полная заявка с маршрутом, весом, объёмом, грузом, датой и ставкой', () => {
    const r = parse('Хоргос - Алматы, 25219 кг, 86 кубов, тент, груз - текстиль, готовность 15.09, EXW, ставка 6600 usd');
    expect(r.originPoint).toBe('Хоргос');
    expect(r.destinationPoint).toBe('Алматы');
    expect(r.weightKg).toBe(25219);
    expect(r.volumeM3).toBe(86);
    expect(r.cargoName).toBe('текстиль');
    expect(r.vehicleType).toBe('тент');
    expect(r.deliveryTerms).toBe('EXW');
    expect(r.cargoReadyDate).toBe('2026-09-15');
    expect(r.clientTargetRate).toBe(6600);
    expect(r.clientTargetRateCurrency).toBe('USD');
  });

  it('латиница в названиях городов и запятая как десятичный разделитель', () => {
    const r = parse('Добрый день! Просчитайте пожалуйста Sanmen-Khorgos 2800 kg 6,04 куб, EXW, груз - оборудование');
    expect(r.originPoint).toBe('Sanmen');
    expect(r.destinationPoint).toBe('Khorgos');
    expect(r.weightKg).toBe(2800);
    expect(r.volumeM3).toBe(6.04);
    expect(r.cargoName).toBe('оборудование');
    expect(r.deliveryTerms).toBe('EXW');
  });

  it('«не ADR» означает ложь, а не истину', () => {
    const r = parse('Хоргос-Астана 27240 кг 60 м3 реф груз - продукты питания не ADR бюджет 6600$');
    expect(r.originPoint).toBe('Хоргос');
    expect(r.destinationPoint).toBe('Астана');
    expect(r.weightKg).toBe(27240);
    expect(r.volumeM3).toBe(60);
    expect(r.vehicleType).toBe('реф');
    expect(r.isDangerous).toBe(false);
    expect(r.clientTargetRate).toBe(6600);
    expect(r.clientTargetRateCurrency).toBe('USD');
  });

  it('«из ... в ...», места, тонны, контейнер, дата словами и сумма в долларах', () => {
    const r = parse('нужна машина из Гуанчжоу в Алматы, 20 паллет, 18 тонн, 40HQ, груз готов 20 сентября, до 7000 долларов');
    expect(r.originPoint).toBe('Гуанчжоу');
    expect(r.destinationPoint).toBe('Алматы');
    expect(r.placesCount).toBe(20);
    expect(r.placesUnit).toBe('паллет');
    expect(r.weightKg).toBe(18000);
    expect(r.vehicleType).toBe('40HQ');
    expect(r.cargoReadyDate).toBe('2026-09-20');
    expect(r.clientTargetRate).toBe(7000);
    expect(r.clientTargetRateCurrency).toBe('USD');
  });

  it('сумма в тенге с пробелами и опасный груз', () => {
    const r = parse('Алматы — Москва, 3 800 000 тенге, опасный груз класс 3, ADR, наименование: химия');
    expect(r.originPoint).toBe('Алматы');
    expect(r.destinationPoint).toBe('Москва');
    expect(r.clientTargetRate).toBe(3800000);
    expect(r.clientTargetRateCurrency).toBe('KZT');
    expect(r.isDangerous).toBe(true);
    expect(r.cargoName).toBe('химия');
  });
});

describe('Ловушки: лучше не распознать, чем распознать неверно', () => {
  it('«2,8 т» и «2.8 т» дают одинаковый вес в килограммах', () => {
    expect(parse('вес 2,8 т').weightKg).toBe(2800);
    expect(parse('вес 2.8 т').weightKg).toBe(2800);
  });

  it('голое число без единицы и ключевого слова не попадает никуда', () => {
    const r = parse('Хоргос - Алматы 12345');
    expect(r.weightKg).toBeUndefined();
    expect(r.volumeM3).toBeUndefined();
    expect(r.placesCount).toBeUndefined();
    expect(r.clientTargetRate).toBeUndefined();
  });

  it('сумма без валюты не подставляется', () => {
    expect(parse('ставка 6600').clientTargetRate).toBeUndefined();
    expect(parse('ставка 6600').clientTargetRateCurrency).toBeUndefined();
  });

  it('«груз - текстиль» не превращается в маршрут', () => {
    const r = parse('груз - текстиль, 20 тонн');
    expect(r.cargoName).toBe('текстиль');
    expect(r.originPoint).toBeUndefined();
    expect(r.destinationPoint).toBeUndefined();
  });

  it('составное название города не разрывается на маршрут', () => {
    const r = parse('Усть-Каменогорск, 20 тонн, тент');
    expect(r.originPoint).toBeUndefined();
    expect(r.destinationPoint).toBeUndefined();
  });

  it('название груза не утаскивает соседние признаки', () => {
    expect(parse('груз - продукты питания не ADR').cargoName).toBe('продукты питания');
    expect(parse('груз - текстиль тент 20 тонн').cargoName).toBe('текстиль');
    expect(parse('груз: обувь готовность 15.09').cargoName).toBe('обувь');
    expect(parse('груз — мебель EXW').cargoName).toBe('мебель');
  });

  it('«без ADR» — это ложь', () => {
    expect(parse('20 тонн без ADR').isDangerous).toBe(false);
    expect(parse('20 тонн, неопасный').isDangerous).toBe(false);
  });

  it('когда про опасность не сказано ничего, поле не трогается', () => {
    expect(parse('Хоргос - Алматы, 20 тонн').isDangerous).toBeUndefined();
  });

  it('текст без единого признака не заполняет ничего', () => {
    expect(parse('Здравствуйте! Когда сможете ответить?')).toEqual({});
  });

  it('пустой ввод не ломает разбор', () => {
    expect(parse('')).toEqual({});
  });

  it('«рефрижератор» не подменяется коротким «реф»', () => {
    expect(parse('нужен рефрижератор, 20 тонн').vehicleType).toBe('рефрижератор');
  });

  it('дата без года переносится на следующий год, если в этом уже прошла', () => {
    expect(parse('готовность 15.01').cargoReadyDate).toBe('2027-01-15');
    expect(parse('готовность 31.12').cargoReadyDate).toBe('2026-12-31');
  });
});
