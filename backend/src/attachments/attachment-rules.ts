import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

/**
 * Разрешённые типы вложений (решение владельца 2026-07-30: «документы и картинки»).
 * Исполняемые файлы и SVG сознательно не допускаются: SVG может содержать скрипт
 * и выстрелить при открытии в браузере.
 */
export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp', '.heic',
  '.zip',
] as const;

export const DEFAULT_MAX_UPLOAD_MB = 25;

/** Расширение файла в нижнем регистре, включая точку. Пустая строка, если его нет. */
export function fileExtension(fileName: string): string {
  return path.extname(fileName || '').toLowerCase();
}

export function isAllowedExtension(fileName: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(fileName));
}

/**
 * Имя, под которым файл ляжет на диск. Собирается системой из случайного
 * идентификатора и расширения — оригинальное имя на диск не попадает, поэтому
 * подставить путь через имя файла («../../etc/passwd») невозможно.
 */
export function buildStoredName(originalName: string): string {
  return `${randomUUID()}${fileExtension(originalName)}`;
}

/** Отсекает путь из имени, присланного клиентом: показываем только имя файла. */
export function sanitizeFileName(originalName: string): string {
  const base = (originalName || '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.slice(0, 200) || 'файл';
}

/**
 * Проверяет файл перед сохранением. Бросает понятную пользователю ошибку,
 * если тип не разрешён или размер больше настроенного предела.
 */
export function assertUploadAllowed(
  file: { originalname: string; size: number } | undefined,
  maxUploadMb: number = DEFAULT_MAX_UPLOAD_MB,
): void {
  if (!file) throw new BadRequestException('Файл не передан');
  if (!isAllowedExtension(file.originalname)) {
    throw new BadRequestException(
      `Такой тип файла загрузить нельзя. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new BadRequestException(`Файл больше ${maxUploadMb} МБ — уменьшите размер или разбейте на части`);
  }
  if (file.size === 0) throw new BadRequestException('Файл пустой');
}

/**
 * Проверяет, что итоговый путь не вышел за пределы папки хранилища.
 * Страховка на случай, если в базу когда-нибудь попадёт «кривое» storedName.
 */
export function resolveStoredPath(uploadsDir: string, storedName: string): string {
  const full = path.resolve(uploadsDir, storedName);
  const root = path.resolve(uploadsDir);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new BadRequestException('Некорректный путь к файлу');
  }
  return full;
}

/** Человекочитаемый размер для интерфейса: 1.4 МБ, 320 КБ. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
