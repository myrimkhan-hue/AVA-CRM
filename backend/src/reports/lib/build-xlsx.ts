import JSZip = require('jszip');

// Минимальный генератор .xlsx на jszip (jszip уже используется для .docx в Этапе 3).
// Готовые библиотеки не подключаем: exceljs тянет 10 уязвимостей и не обновлялся
// больше года, от xlsx (SheetJS) в проекте отказались раньше по той же причине.
// Файл .xlsx — это zip с XML-частями; здесь собирается их необходимый минимум:
// строки пишутся inline (без sharedStrings), числа и даты — настоящими числами,
// чтобы в Excel работали сортировка и суммы.

export type XlsxCellType = 'text' | 'number' | 'money' | 'date';

export interface XlsxColumn<Row> {
  header: string;
  /** Как достать значение строки. Вернуть null/undefined для пустой ячейки. */
  value: (row: Row) => string | number | Date | null | undefined;
  type?: XlsxCellType;
  /** Ширина колонки в символах, по умолчанию подбирается по заголовку. */
  width?: number;
}

export interface XlsxSheet<Row = unknown> {
  name: string;
  columns: XlsxColumn<Row>[];
  rows: Row[];
}

// Номера стилей соответствуют порядку <xf> в cellXfs (см. STYLES_XML).
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_MONEY = 3;

/** Excel считает дни от 30.12.1899 (система дат 1900 с её известным багом високосного года). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Управляющие символы недопустимы в XML и ломают файл при открытии.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let result = '';
  let current = index;
  while (current >= 0) {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  }
  return result;
}

/** Дата -> порядковый номер дня в Excel. */
export function toExcelSerial(date: Date): number {
  return (date.getTime() - EXCEL_EPOCH_MS) / (24 * 60 * 60 * 1000);
}

/** Имя листа: Excel запрещает : \ / ? * [ ] и больше 31 символа. */
export function safeSheetName(name: string, fallback = 'Лист'): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || fallback).slice(0, 31);
}

function cellXml(reference: string, value: unknown, type: XlsxCellType): string {
  if (value === null || value === undefined || value === '') return '';

  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
    }
    return `<c r="${reference}" s="${STYLE_DATE}"><v>${toExcelSerial(date)}</v></c>`;
  }

  if (type === 'number' || type === 'money') {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
    }
    const style = type === 'money' ? ` s="${STYLE_MONEY}"` : '';
    return `<c r="${reference}"${style}><v>${numeric}</v></c>`;
  }

  return `<c r="${reference}" s="${STYLE_DEFAULT}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

function sheetXml<Row>(sheet: XlsxSheet<Row>): string {
  const { columns, rows } = sheet;
  const lastColumn = columnLetter(Math.max(columns.length - 1, 0));
  const lastRow = rows.length + 1;

  const cols = columns
    .map((column, index) => {
      const width = column.width ?? Math.min(Math.max(column.header.length + 4, 12), 40);
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const headerCells = columns
    .map((column, index) => `<c r="${columnLetter(index)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`)
    .join('');

  const bodyRows = rows
    .map((row, rowIndex) => {
      const cells = columns
        .map((column, columnIndex) =>
          cellXml(`${columnLetter(columnIndex)}${rowIndex + 2}`, column.value(row), column.type ?? 'text'),
        )
        .join('');
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData><row r="1">${headerCells}</row>${bodyRows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF3F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`;

/**
 * Собирает .xlsx из списка листов. Возвращает Buffer готового файла.
 * Листы в одной книге обычно имеют разные типы строк, поэтому здесь XlsxSheet<any>:
 * типобезопасность обеспечивается на месте описания каждого листа.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildXlsx(sheets: Array<XlsxSheet<any>>): Promise<Buffer> {
  if (sheets.length === 0) throw new Error('Нужен хотя бы один лист');

  // Имена листов в книге должны быть уникальными, иначе Excel не откроет файл.
  const usedNames = new Set<string>();
  const names = sheets.map((sheet, index) => {
    const base = safeSheetName(sheet.name, `Лист${index + 1}`);
    let name = base;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      const tail = ` (${suffix})`;
      name = `${base.slice(0, 31 - tail.length)}${tail}`;
      suffix += 1;
    }
    usedNames.add(name.toLowerCase());
    return name;
  });

  const zip = new JSZip();

  const sheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );

  const sheetTags = names
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('');
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`,
  );

  const sheetRels = names
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );

  zip.file('xl/styles.xml', STYLES_XML);
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet));
  });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Имя файла выгрузки вида «Дебиторка_2026-07-30.xlsx», безопасное для заголовка ответа. */
export function xlsxFileName(base: string, date = new Date()): string {
  const cleaned = base.replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/\s+/g, '_').slice(0, 60);
  return `${cleaned || 'report'}_${date.toISOString().slice(0, 10)}.xlsx`;
}
