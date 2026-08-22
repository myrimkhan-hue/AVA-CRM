import { DocumentTemplateType } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import JSZip = require('jszip');
import { XMLValidator } from 'fast-xml-parser';
import {
  DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS,
} from './document-template.constants';
import {
  validateDocumentTemplate,
  validateDocxTemplate,
} from './document-template-validator';
import { BUILTIN_TEMPLATE_PATHS } from './documents.constants';
import { fillDocxBuffer } from './lib/fill-docx';

async function docxBuffer(documentXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function documentXml(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    `<w:body>${body}</w:body>`,
    '</w:document>',
  ].join('');
}

function xml(text: string): string {
  return documentXml(`<w:p>${text}</w:p>`);
}

describe('Проверка Word-шаблонов', () => {
  it('отклоняет шаблон без обязательной метки и перечисляет её', async () => {
    const buffer = await docxBuffer(xml('<w:r><w:t>Обычный текст</w:t></w:r>'));

    await expect(validateDocxTemplate(buffer, ['НОМЕР_ДОГОВОРА']))
      .rejects.toThrow('{НОМЕР_ДОГОВОРА}');
  });

  it('распознаёт и заменяет метку, разорванную Word на несколько XML-фрагментов', async () => {
    const buffer = await docxBuffer(xml([
      '<w:r><w:t>{НОМЕР_</w:t></w:r>',
      '<w:r><w:t>ДОГОВОРА}</w:t></w:r>',
    ].join('')));

    await expect(validateDocxTemplate(buffer, ['НОМЕР_ДОГОВОРА']))
      .resolves.toEqual({
        placeholders: ['НОМЕР_ДОГОВОРА'],
        unknownPlaceholders: [],
      });

    const filled = await fillDocxBuffer(buffer, { НОМЕР_ДОГОВОРА: 'Д-42' });
    const zip = await JSZip.loadAsync(filled);
    const resultXml = await zip.file('word/document.xml')!.async('string');
    expect(resultXml).toContain('Д-42');
    expect(resultXml).not.toContain('НОМЕР_ДОГОВОРА');
    expect(resultXml).not.toContain('{НОМ');
    expect(XMLValidator.validate(resultXml)).toBe(true);
  });

  it('распознаёт и целиком заменяет разорванную метку внутри таблицы', async () => {
    const buffer = await docxBuffer(documentXml([
      '<w:tbl><w:tr><w:tc><w:p>',
      '<w:r><w:t>{НОМЕР_</w:t></w:r>',
      '<w:r><w:t>ДОГОВОРА}</w:t></w:r>',
      '</w:p></w:tc></w:tr></w:tbl>',
    ].join('')));

    await expect(validateDocxTemplate(buffer, ['НОМЕР_ДОГОВОРА']))
      .resolves.toMatchObject({ placeholders: ['НОМЕР_ДОГОВОРА'] });

    const filled = await fillDocxBuffer(buffer, { НОМЕР_ДОГОВОРА: 'Д-43' });
    const zip = await JSZip.loadAsync(filled);
    const resultXml = await zip.file('word/document.xml')!.async('string');
    expect(resultXml).toContain('Д-43');
    expect(resultXml).not.toContain('{НОМ');
    expect(XMLValidator.validate(resultXml)).toBe(true);
  });

  it('не объединяет части метки из разных абзацев', async () => {
    const buffer = await docxBuffer(documentXml([
      '<w:p><w:r><w:t>{НОМЕР_</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>ДОГОВОРА}</w:t></w:r></w:p>',
    ].join('')));

    await expect(validateDocxTemplate(buffer, ['НОМЕР_ДОГОВОРА']))
      .rejects.toThrow('{НОМЕР_ДОГОВОРА}');

    const filled = await fillDocxBuffer(buffer, { НОМЕР_ДОГОВОРА: 'Д-44' });
    const zip = await JSZip.loadAsync(filled);
    const resultXml = await zip.file('word/document.xml')!.async('string');
    expect(resultXml).toContain('{НОМЕР_');
    expect(resultXml).toContain('ДОГОВОРА}');
  });

  it('отклоняет файл, который не является DOCX-архивом', async () => {
    await expect(validateDocxTemplate(Buffer.from('это не zip'), ['НОМЕР']))
      .rejects.toThrow('Файл не является корректным документом DOCX');
  });

  it('возвращает лишние метки как предупреждение и не отклоняет файл', async () => {
    const buffer = await docxBuffer(xml(
      '<w:r><w:t>{НОМЕР}</w:t></w:r><w:r><w:t>{НЕИЗВЕСТНАЯ_МЕТКА}</w:t></w:r>',
    ));

    await expect(validateDocxTemplate(buffer, ['НОМЕР'])).resolves.toEqual({
      placeholders: ['НОМЕР', 'НЕИЗВЕСТНАЯ_МЕТКА'],
      unknownPlaceholders: ['НЕИЗВЕСТНАЯ_МЕТКА'],
    });
  });

  it('разрешает отсутствие известной необязательной метки', async () => {
    const buffer = await docxBuffer(xml('<w:r><w:t>{ОБЯЗАТЕЛЬНАЯ}</w:t></w:r>'));

    await expect(validateDocxTemplate(
      buffer,
      ['ОБЯЗАТЕЛЬНАЯ'],
      ['ОБЯЗАТЕЛЬНАЯ', 'НЕОБЯЗАТЕЛЬНАЯ'],
    )).resolves.toEqual({
      placeholders: ['ОБЯЗАТЕЛЬНАЯ'],
      unknownPlaceholders: [],
    });
  });

  it.each([
    DocumentTemplateType.CONTRACT,
    DocumentTemplateType.TRANSPORT_REQUEST,
  ])('встроенный шаблон %s проходит собственную проверку', async (type) => {
    const buffer = await readFile(BUILTIN_TEMPLATE_PATHS[type]);
    const result = await validateDocumentTemplate(buffer, type);
    const required = DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS[type];

    expect(result.placeholders).toHaveLength(required.length);
    expect(new Set(result.placeholders)).toEqual(new Set(required));
    expect(result.unknownPlaceholders).toEqual([]);
  });
});
