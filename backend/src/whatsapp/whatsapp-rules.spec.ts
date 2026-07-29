import { normalizePhone, renderTemplate, toWhatsAppChatId } from './whatsapp-rules';

describe('normalizePhone', () => {
  it('приводит разные форматы к одинаковым последним 10 цифрам', () => {
    expect(normalizePhone('+7 701 111 22 33')).toBe('7011112233');
    expect(normalizePhone('8 (701) 111-22-33')).toBe('7011112233');
    expect(normalizePhone('87011112233')).toBe('7011112233');
  });

  it('возвращает null для пустого или слишком короткого значения', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('renderTemplate', () => {
  it('подставляет известные переменные', () => {
    expect(renderTemplate('Ваш груз по заявке {{number}} прошёл таможню', { number: 'AVA-2026-0001' }))
      .toBe('Ваш груз по заявке AVA-2026-0001 прошёл таможню');
  });

  it('оставляет неизвестную переменную как есть', () => {
    expect(renderTemplate('Привет, {{name}}!', {})).toBe('Привет, {{name}}!');
  });

  it('подставляет несколько переменных', () => {
    expect(renderTemplate('{{a}} и {{b}}', { a: '1', b: '2' })).toBe('1 и 2');
  });
});

describe('toWhatsAppChatId', () => {
  it('заменяет ведущую 8 на 7 для номера из 11 цифр', () => {
    expect(toWhatsAppChatId('8 (701) 111-22-33')).toBe('77011112233');
  });

  it('добавляет код страны 7 к локальному 10-значному номеру', () => {
    expect(toWhatsAppChatId('701 111 22 33')).toBe('77011112233');
  });

  it('оставляет номер с кодом страны 7 без изменений', () => {
    expect(toWhatsAppChatId('+7 701 111 22 33')).toBe('77011112233');
  });

  it('оставляет прочие форматы как есть', () => {
    expect(toWhatsAppChatId('+86 138 0013 8000')).toBe('8613800138000');
  });

  it('возвращает null для пустого значения', () => {
    expect(toWhatsAppChatId(null)).toBeNull();
    expect(toWhatsAppChatId('')).toBeNull();
  });
});
