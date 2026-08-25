import { readFile } from 'node:fs/promises';
import JSZip = require('jszip');

// DOCX открывается как zip, а метки заменяются прямо в XML документа.
// Диапазон видимого текста позволяет одинаково обрабатывать цельные метки
// и метки, которые Word разорвал на несколько элементов <w:t>.
// Метка, разорванная между несколькими абзацами <w:p>, не распознаётся.

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type DocxValues = Record<string, string | number | null | undefined>;
export type DocxRows = Record<string, DocxValues[]>;

interface PlaceholderRange {
  key: string;
  start: number;
  end: number;
}

function placeholderRanges(xml: string): PlaceholderRange[] {
  const ranges: PlaceholderRange[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  const paragraphs = [...xml.matchAll(paragraphPattern)];
  const blocks = paragraphs.length > 0
    ? paragraphs.map((match) => ({
        xml: match[0],
        offset: match.index,
      }))
    : [{ xml, offset: 0 }];

  for (const block of blocks) {
    const fragments: Array<{
      text: string;
      textStart: number;
      textEnd: number;
      xmlStart: number;
    }> = [];
    const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let visibleText = '';
    for (const match of block.xml.matchAll(textPattern)) {
      const text = match[1];
      const contentOffset = match[0].indexOf('>') + 1;
      fragments.push({
        text,
        textStart: visibleText.length,
        textEnd: visibleText.length + text.length,
        xmlStart: block.offset + match.index + contentOffset,
      });
      visibleText += text;
    }

    for (const match of visibleText.matchAll(/\{([^{}\r\n]+)\}/g)) {
      const visibleStart = match.index;
      const visibleEnd = visibleStart + match[0].length;
      const first = fragments.find(
        (fragment) => visibleStart >= fragment.textStart && visibleStart < fragment.textEnd,
      );
      const last = fragments.find(
        (fragment) => visibleEnd > fragment.textStart && visibleEnd <= fragment.textEnd,
      );
      if (!first || !last) continue;
      ranges.push({
        key: match[1],
        start: first.xmlStart + visibleStart - first.textStart,
        end: last.xmlStart + visibleEnd - last.textStart,
      });
    }
  }

  return ranges;
}

/** Метки, которые генератор сможет заменить, включая разорванные Word XML-фрагментами. */
export function findDocxPlaceholders(xml: string): string[] {
  return [...new Set(placeholderRanges(xml).map((item) => item.key))];
}

export function replaceDocxPlaceholders(xml: string, values: DocxValues): string {
  const replacements = placeholderRanges(xml)
    .filter((item) => Object.prototype.hasOwnProperty.call(values, item.key))
    .sort((left, right) => right.start - left.start);
  let result = xml;
  for (const item of replacements) {
    const value = values[item.key];
    const replacement = value === null || value === undefined
      ? ''
      : escapeXml(String(value));
    result = result.slice(0, item.start) + replacement + result.slice(item.end);
  }
  return result;
}

const REPEATED_ROW_PLACEHOLDER = /^СТРОКА_/;

function repeatedRowPlaceholders(xml: string, rows: DocxRows): PlaceholderRange[] {
  return placeholderRanges(xml).filter(
    (item) => REPEATED_ROW_PLACEHOLDER.test(item.key)
      && Object.prototype.hasOwnProperty.call(rows, item.key),
  );
}

function assertNoNestedTablesInRepeatedRows(xml: string, rows: DocxRows): void {
  const rowTagPattern = /<\/?w:tr\b[^>]*>/g;

  for (const placeholder of repeatedRowPlaceholders(xml, rows)) {
    const openRows: number[] = [];
    rowTagPattern.lastIndex = 0;
    for (const match of xml.matchAll(rowTagPattern)) {
      if (match.index >= placeholder.start) break;
      if (match[0].startsWith('</')) {
        openRows.pop();
      } else {
        openRows.push(match.index);
      }
    }

    const rowStart = openRows.at(-1);
    if (rowStart === undefined) continue;

    let depth = 0;
    let rowEnd: number | undefined;
    rowTagPattern.lastIndex = rowStart;
    for (const match of xml.matchAll(rowTagPattern)) {
      if (match[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) {
          rowEnd = match.index + match[0].length;
          break;
        }
      } else {
        depth += 1;
      }
    }

    const rowXml = rowEnd === undefined ? xml.slice(rowStart) : xml.slice(rowStart, rowEnd);
    if (openRows.length > 1 || /<w:tbl\b[^>]*>/.test(rowXml)) {
      throw new Error(
        'Вложенная таблица внутри повторяемой строки не поддерживается. '
        + `Уберите таблицу из строки с меткой {${placeholder.key}}.`,
      );
    }
  }
}

function expandDocxTableRows(xml: string, rows: DocxRows): string {
  // Строки таблиц разбираются регулярным выражением. Вложенная таблица нарушает
  // границы <w:tr>, поэтому выше она выявляется заранее и приводит к понятной ошибке.
  assertNoNestedTablesInRepeatedRows(xml, rows);
  const rowPattern = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;

  return xml.replace(rowPattern, (rowXml) => {
    const rowPlaceholder = findDocxPlaceholders(rowXml).find(
      (key) => REPEATED_ROW_PLACEHOLDER.test(key)
        && Object.prototype.hasOwnProperty.call(rows, key),
    );
    if (!rowPlaceholder) return rowXml;

    return rows[rowPlaceholder]
      .map((itemValues) => replaceDocxPlaceholders(rowXml, {
        ...itemValues,
        [rowPlaceholder]: '',
      }))
      .join('');
  });
}

export async function fillDocxBuffer(
  templateBuffer: Buffer,
  values: DocxValues,
  rows?: DocxRows,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('В шаблоне не найден word/document.xml');
  const xml = await documentFile.async('string');
  const expandedXml = rows ? expandDocxTableRows(xml, rows) : xml;
  zip.file('word/document.xml', replaceDocxPlaceholders(expandedXml, values));
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Заполняет .docx-шаблон, подставляя {КЛЮЧ} -> значение. Возвращает Buffer готового файла. */
export async function fillDocx(
  templatePath: string,
  values: DocxValues,
  rows?: DocxRows,
): Promise<Buffer> {
  const templateBuffer = await readFile(templatePath);
  return fillDocxBuffer(templateBuffer, values, rows);
}

/** Безопасное имя файла из названия контрагента: только буквы/цифры/дефис/пробел, пробелы -> _, максимум 40 символов. */
export function safeName(name: string | null | undefined, fallback = 'other'): string {
  const source = name && name.trim() ? name : fallback;
  const cleaned = source.replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/\s+/g, '_');
  return cleaned.slice(0, 40);
}
