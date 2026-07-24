import * as path from 'node:path';
import JSZip = require('jszip');
import { fillDocx, safeName } from './fill-docx';

const CONTRACT_TEMPLATE = path.join(__dirname, '../templates/contract.docx');

describe('fillDocx', () => {
  it('substitutes {КЛЮЧ} tokens with escaped values and leaves the rest intact', async () => {
    const buffer = await fillDocx(CONTRACT_TEMPLATE, {
      НОМЕР_ДОГОВОРА: 'TT-EX-2407/2026',
      ДАТА_ДОГОВОРА: '24 июля 2026 г.',
      ЗАКАЗЧИК_НАЗВАНИЕ: 'ТОО "Ромашка & Ко" <тест>',
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');

    expect(xml).not.toContain('{НОМЕР_ДОГОВОРА}');
    expect(xml).not.toContain('{ДАТА_ДОГОВОРА}');
    expect(xml).toContain('TT-EX-2407/2026');
    expect(xml).toContain('24 июля 2026 г.');
    // спецсимволы должны быть экранированы, а не сломать XML
    expect(xml).toContain('ТОО &quot;Ромашка &amp; Ко&quot; &lt;тест&gt;');
  });

  it('leaves unknown tokens with no matching value untouched', async () => {
    const buffer = await fillDocx(CONTRACT_TEMPLATE, {
      НОМЕР_ДОГОВОРА: '123',
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('{ЗАКАЗЧИК_НАЗВАНИЕ}');
  });
});

describe('safeName', () => {
  it('replaces whitespace with underscores and strips punctuation', () => {
    expect(safeName('ТОО "Ромашка" №1')).toBe('ТОО_Ромашка_1');
  });

  it('falls back when the name is empty', () => {
    expect(safeName('', 'клиент')).toBe('клиент');
    expect(safeName(undefined, 'клиент')).toBe('клиент');
  });

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(60);
    expect(safeName(long).length).toBe(40);
  });
});
