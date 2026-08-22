import { BadRequestException } from '@nestjs/common';
import { DocumentTemplateType } from '@prisma/client';
import JSZip = require('jszip');
import {
  DOCUMENT_TEMPLATE_PLACEHOLDERS,
  DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS,
} from './document-template.constants';
import { findDocxPlaceholders } from './lib/fill-docx';

export interface DocumentTemplateValidationResult {
  placeholders: string[];
  unknownPlaceholders: string[];
}

export async function validateDocxTemplate(
  buffer: Buffer,
  requiredPlaceholders: readonly string[],
  availablePlaceholders: readonly string[] = requiredPlaceholders,
): Promise<DocumentTemplateValidationResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new BadRequestException('Файл не является корректным документом DOCX');
  }

  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new BadRequestException(
      'Файл не является корректным документом DOCX: внутри нет word/document.xml',
    );
  }

  const xml = await documentFile.async('string');
  const placeholders = findDocxPlaceholders(xml);
  const found = new Set(placeholders);
  const available = new Set(availablePlaceholders);
  const missing = requiredPlaceholders.filter((key) => !found.has(key));
  if (missing.length > 0) {
    throw new BadRequestException(
      `В шаблоне отсутствуют обязательные метки: ${missing.map((key) => `{${key}}`).join(', ')}`,
    );
  }

  return {
    placeholders,
    unknownPlaceholders: placeholders.filter((key) => !available.has(key)),
  };
}

export function validateDocumentTemplate(
  buffer: Buffer,
  type: DocumentTemplateType,
): Promise<DocumentTemplateValidationResult> {
  return validateDocxTemplate(
    buffer,
    DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS[type],
    DOCUMENT_TEMPLATE_PLACEHOLDERS[type],
  );
}
