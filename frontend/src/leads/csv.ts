export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function detectDelimiter(firstLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = candidates[0];
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/** Разбирает CSV/TSV-текст (в т.ч. вставленный из буфера обмена) с учётом кавычек по RFC 4180. */
export function parseCsv(text: string): ParsedCsv {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(normalized.slice(0, normalized.indexOf('\n') + 1 || normalized.length));

  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); table.push(row); row = []; };

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === delimiter) { pushField(); continue; }
    if (char === '\n') { pushRow(); continue; }
    field += char;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmpty = table.filter((line) => line.some((cell) => cell.trim() !== ''));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((header) => header.trim()), rows };
}
