import { XMLValidator } from 'fast-xml-parser';
import JSZip = require('jszip');
import {
  buildXlsx,
  columnLetter,
  safeSheetName,
  toExcelSerial,
  xlsxFileName,
  XlsxSheet,
} from './build-xlsx';

interface Row {
  name: string;
  amount: number;
  due: Date;
}

const sampleSheet: XlsxSheet<Row> = {
  name: 'Дебиторка',
  columns: [
    { header: 'Клиент', value: (row) => row.name },
    { header: 'Долг', value: (row) => row.amount, type: 'money' },
    { header: 'Срок оплаты', value: (row) => row.due, type: 'date' },
  ],
  rows: [
    { name: 'ТОО «Ромашка» & Ко', amount: 1234.56, due: new Date('2026-07-15T00:00:00.000Z') },
    { name: 'ИП <Тест>', amount: 0, due: new Date('2026-08-01T00:00:00.000Z') },
  ],
};

async function readPart(buffer: Buffer, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(path);
  if (!file) throw new Error(`В книге нет части ${path}`);
  return file.async('string');
}

describe('columnLetter', () => {
  it('нумерует колонки как Excel', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
  });
});

describe('toExcelSerial', () => {
  it('переводит дату в порядковый номер дня Excel', () => {
    // Опорные значения: 01.03.1900 = 61, 01.01.2000 = 36526 (проверяется в самом Excel).
    expect(toExcelSerial(new Date('1900-03-01T00:00:00.000Z'))).toBe(61);
    expect(toExcelSerial(new Date('2000-01-01T00:00:00.000Z'))).toBe(36526);
    expect(toExcelSerial(new Date('2026-07-30T00:00:00.000Z'))).toBe(46233);
  });

  it('соседние дни отличаются ровно на единицу', () => {
    const first = toExcelSerial(new Date('2026-07-30T00:00:00.000Z'));
    const second = toExcelSerial(new Date('2026-07-31T00:00:00.000Z'));
    expect(second - first).toBe(1);
  });
});

describe('safeSheetName', () => {
  it('убирает запрещённые символы и обрезает до 31 символа', () => {
    expect(safeSheetName('Отчёт: план/факт [2026]')).toBe('Отчёт  план факт  2026');
    expect(safeSheetName('я'.repeat(50)).length).toBe(31);
  });

  it('подставляет запасное имя для пустого', () => {
    expect(safeSheetName('   ', 'Лист1')).toBe('Лист1');
  });
});

describe('xlsxFileName', () => {
  it('собирает имя файла с датой', () => {
    expect(xlsxFileName('Дебиторка', new Date('2026-07-30T10:00:00.000Z'))).toBe('Дебиторка_2026-07-30.xlsx');
  });

  it('вычищает символы, недопустимые в имени файла', () => {
    expect(xlsxFileName('Отчёт "план/факт"', new Date('2026-01-05T00:00:00.000Z'))).toBe('Отчёт_планфакт_2026-01-05.xlsx');
  });
});

describe('buildXlsx', () => {
  it('собирает книгу со всеми обязательными частями', async () => {
    const buffer = await buildXlsx([sampleSheet]);
    const zip = await JSZip.loadAsync(buffer);
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(zip.file(part)).not.toBeNull();
    }
  });

  it('пишет заголовки, экранирует спецсимволы и не ломает XML', async () => {
    const xml = await readPart(await buildXlsx([sampleSheet]), 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<t>Клиент</t>');
    expect(xml).toContain('ТОО «Ромашка» &amp; Ко');
    expect(xml).toContain('ИП &lt;Тест&gt;');
    expect(xml).not.toContain('<Тест>');
  });

  it('пишет числа и даты числами, а не текстом', async () => {
    const xml = await readPart(await buildXlsx([sampleSheet]), 'xl/worksheets/sheet1.xml');
    // сумма — обычное число со стилем денег
    expect(xml).toContain('<v>1234.56</v>');
    // дата — порядковый номер дня, а не строка
    expect(xml).toContain(`<v>${toExcelSerial(new Date('2026-07-15T00:00:00.000Z'))}</v>`);
    expect(xml).not.toContain('2026-07-15');
  });

  it('оставляет ячейку пустой для null и undefined', async () => {
    const xml = await readPart(
      await buildXlsx([
        {
          name: 'Пусто',
          columns: [
            { header: 'A', value: () => null },
            { header: 'B', value: () => undefined },
            { header: 'C', value: () => 'есть' },
          ],
          rows: [{}],
        },
      ]),
      'xl/worksheets/sheet1.xml',
    );
    expect(xml).toContain('<row r="2">');
    expect(xml).not.toContain('r="A2"');
    expect(xml).not.toContain('r="B2"');
    expect(xml).toContain('r="C2"');
  });

  it('нечисловое значение в числовой колонке пишет текстом, а не ломает файл', async () => {
    const xml = await readPart(
      await buildXlsx([
        {
          name: 'Смесь',
          columns: [{ header: 'Сумма', value: () => 'нет данных', type: 'money' }],
          rows: [{}],
        },
      ]),
      'xl/worksheets/sheet1.xml',
    );
    expect(xml).toContain('<t>нет данных</t>');
  });

  it('делает имена листов уникальными и укладывает их в 31 символ', async () => {
    const xml = await readPart(
      await buildXlsx([
        { name: 'Отчёт', columns: [{ header: 'A', value: () => 'x' }], rows: [{}] },
        { name: 'Отчёт', columns: [{ header: 'A', value: () => 'y' }], rows: [{}] },
      ]),
      'xl/workbook.xml',
    );
    expect(xml).toContain('name="Отчёт"');
    expect(xml).toContain('name="Отчёт (2)"');
  });

  it('поддерживает несколько листов', async () => {
    const buffer = await buildXlsx([
      sampleSheet,
      { name: 'Второй', columns: [{ header: 'Б', value: () => 'значение' }], rows: [{}] },
    ]);
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('xl/worksheets/sheet2.xml')).not.toBeNull();
    const types = await readPart(buffer, '[Content_Types].xml');
    expect(types).toContain('/xl/worksheets/sheet2.xml');
    const rels = await readPart(buffer, 'xl/_rels/workbook.xml.rels');
    // стили должны получить отдельный id после всех листов
    expect(rels).toContain('Id="rId3"');
    expect(rels).toContain('styles.xml');
  });

  it('требует хотя бы один лист', async () => {
    await expect(buildXlsx([])).rejects.toThrow('Нужен хотя бы один лист');
  });

  it('все XML-части книги синтаксически корректны', async () => {
    // Excel не открывает файл при малейшей ошибке разметки, поэтому проверяем
    // каждую часть валидатором, а не только наличие подстрок.
    const zip = await JSZip.loadAsync(
      await buildXlsx([
        sampleSheet,
        {
          name: 'Кавычки & <теги>',
          columns: [{ header: 'Текст «с» кавычками', value: (row: { v: string }) => row.v }],
          rows: [{ v: 'значение с & и < и > и "' }],
        },
      ]),
    );
    const parts = Object.keys(zip.files).filter((name) => name.endsWith('.xml') || name.endsWith('.rels'));
    expect(parts.length).toBeGreaterThan(5);
    for (const part of parts) {
      const xml = await zip.file(part)!.async('string');
      expect({ part, valid: XMLValidator.validate(xml) }).toEqual({ part, valid: true });
    }
  });
});
