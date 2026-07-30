import type { Response } from 'express';

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Отдаёт готовую книгу файлом на скачивание. Имя файла русское, поэтому только
 * filename*=UTF-8'' (RFC 5987) — так же, как для .docx и .pdf в модуле документов.
 */
export function sendXlsx(res: Response, file: { buffer: Buffer; filename: string }): void {
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  );
  res.send(file.buffer);
}
