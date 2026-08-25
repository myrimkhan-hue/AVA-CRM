import { DocumentTemplateType } from '@prisma/client';
import * as path from 'node:path';
import JSZip = require('jszip');
import { DOCUMENT_TEMPLATE_PLACEHOLDERS } from '../document-template.constants';
import { BUILTIN_TEMPLATE_PATHS } from '../documents.constants';
import {
  fillDocx,
  fillDocxBuffer,
  findDocxPlaceholders,
  safeName,
} from './fill-docx';

const CONTRACT_TEMPLATE = path.join(__dirname, '../templates/contract.docx');

function documentXml(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    `<w:body>${body}</w:body>`,
    '</w:document>',
  ].join('');
}

async function createDocx(xml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}

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

  it.each([
    DocumentTemplateType.CONTRACT,
    DocumentTemplateType.TRANSPORT_REQUEST,
    DocumentTemplateType.INVOICE,
    DocumentTemplateType.ACT,
  ])('replaces every known token used by the built-in %s template', async (type) => {
    const knownPlaceholders = DOCUMENT_TEMPLATE_PLACEHOLDERS[type];
    const values = Object.fromEntries(
      knownPlaceholders.map((key) => [key, `Значение ${key}`]),
    );
    const buffer = await fillDocx(BUILTIN_TEMPLATE_PATHS[type], values);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const remainingKnown = findDocxPlaceholders(xml)
      .filter((key) => (knownPlaceholders as readonly string[]).includes(key));

    expect(remainingKnown).toEqual([]);
  });
});

describe('fillDocx repeated table rows', () => {
  it('repeats a template row for every item and substitutes its own escaped values', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{СТРОКА_УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{УСЛУГА}</w:t></w:r>',
      '<w:r><w:t>{ЦЕНА}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join('')));

    const result = await fillDocxBuffer(template, {}, {
      СТРОКА_УСЛУГИ: [
        { УСЛУГА: 'Перевозка & погрузка', ЦЕНА: 1000 },
        { УСЛУГА: 'Хранение', ЦЕНА: 2500 },
      ],
    });
    const xml = await readDocumentXml(result);

    expect(xml.match(/<w:tr(?:\s|>)/g)).toHaveLength(2);
    expect(xml).toContain('Перевозка &amp; погрузка');
    expect(xml).toContain('Хранение');
    expect(xml).toContain('1000');
    expect(xml).toContain('2500');
    expect(xml).not.toContain('{СТРОКА_УСЛУГИ}');
  });

  it('removes the template row when its list is empty', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl>',
      '<w:tr><w:tc><w:p><w:r><w:t>Заголовок</w:t></w:r></w:p></w:tc></w:tr>',
      '<w:tr><w:tc><w:p><w:r><w:t>{СТРОКА_УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{УСЛУГА}</w:t></w:r></w:p></w:tc></w:tr>',
      '</w:tbl>',
    ].join('')));

    const result = await fillDocxBuffer(template, {}, { СТРОКА_УСЛУГИ: [] });
    const xml = await readDocumentXml(result);

    expect(xml.match(/<w:tr(?:\s|>)/g)).toHaveLength(1);
    expect(xml).toContain('Заголовок');
    expect(xml).not.toContain('{СТРОКА_УСЛУГИ}');
    expect(xml).not.toContain('{УСЛУГА}');
  });

  it('substitutes an item placeholder split across several Word text nodes', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{СТРОКА_</w:t></w:r><w:r><w:t>УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{НА</w:t></w:r><w:r><w:t>ЗВАНИЕ}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join('')));

    const result = await fillDocxBuffer(template, {}, {
      СТРОКА_УСЛУГИ: [{ НАЗВАНИЕ: 'Доставка' }],
    });
    const xml = await readDocumentXml(result);

    expect(xml).toContain('Доставка');
    expect(xml).not.toContain('{НАЗВАНИЕ}');
    expect(findDocxPlaceholders(xml)).not.toContain('НАЗВАНИЕ');
    expect(findDocxPlaceholders(xml)).not.toContain('СТРОКА_УСЛУГИ');
  });

  it('substitutes common values inside every repeated row', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{СТРОКА_УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{УСЛУГА}</w:t></w:r>',
      '<w:r><w:t>{ВАЛЮТА}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join('')));

    const result = await fillDocxBuffer(template, { ВАЛЮТА: '₸' }, {
      СТРОКА_УСЛУГИ: [
        { УСЛУГА: 'Перевозка' },
        { УСЛУГА: 'Погрузка' },
      ],
    });
    const xml = await readDocumentXml(result);

    expect(xml.match(/₸/g)).toHaveLength(2);
    expect(xml).not.toContain('{ВАЛЮТА}');
  });

  it('keeps row markers untouched when called without the rows argument', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{СТРОКА_УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{ОБЩАЯ_МЕТКА}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join('')));

    const result = await fillDocxBuffer(template, { ОБЩАЯ_МЕТКА: 'Значение' });
    const xml = await readDocumentXml(result);

    expect(xml.match(/<w:tr(?:\s|>)/g)).toHaveLength(1);
    expect(xml).toContain('{СТРОКА_УСЛУГИ}');
    expect(xml).toContain('Значение');
  });

  it('returns row markers and placeholders inside repeated rows for validation', () => {
    const xml = documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{СТРОКА_</w:t></w:r><w:r><w:t>УСЛУГИ}</w:t></w:r>',
      '<w:r><w:t>{УСЛУГА}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join(''));

    expect(findDocxPlaceholders(xml)).toEqual(['СТРОКА_УСЛУГИ', 'УСЛУГА']);
  });

  it('throws a clear error for a nested table inside a repeated row', async () => {
    const template = await createDocx(documentXml([
      '<w:tbl><w:tr><w:tc>',
      '<w:p><w:r><w:t>{СТРОКА_УСЛУГИ}</w:t></w:r></w:p>',
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Вложенная</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
      '</w:tc></w:tr></w:tbl>',
    ].join('')));

    await expect(fillDocxBuffer(template, {}, {
      СТРОКА_УСЛУГИ: [{ УСЛУГА: 'Перевозка' }],
    })).rejects.toThrow(
      'Вложенная таблица внутри повторяемой строки не поддерживается',
    );
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
