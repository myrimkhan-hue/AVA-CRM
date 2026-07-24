import { readFile } from 'node:fs/promises';
import JSZip = require('jszip');

// Порт fillDocx/escapeXml из contract-generator (php/lib/helpers.php):
// открыть .docx как zip, заменить {МЕТКА} на значение прямо в XML документа,
// упаковать обратно. Логика не менялась.

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type DocxValues = Record<string, string | number | null | undefined>;

/** Заполняет .docx-шаблон, подставляя {КЛЮЧ} -> значение. Возвращает Buffer готового файла. */
export async function fillDocx(templatePath: string, values: DocxValues): Promise<Buffer> {
  const templateBuffer = await readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error(`В шаблоне ${templatePath} не найден word/document.xml`);
  }
  let xml = await documentFile.async('string');
  for (const [key, value] of Object.entries(values)) {
    const replacement = value === null || value === undefined ? '' : escapeXml(String(value));
    xml = xml.split(`{${key}}`).join(replacement);
  }
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Безопасное имя файла из названия контрагента: только буквы/цифры/дефис/пробел, пробелы -> _, максимум 40 символов. */
export function safeName(name: string | null | undefined, fallback = 'other'): string {
  const source = name && name.trim() ? name : fallback;
  const cleaned = source.replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/\s+/g, '_');
  return cleaned.slice(0, 40);
}
