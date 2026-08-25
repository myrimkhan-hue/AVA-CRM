import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentTemplateType, Prisma } from '@prisma/client';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  assertUploadAllowed,
  buildStoredName,
  DEFAULT_MAX_UPLOAD_MB,
  fileExtension,
  resolveStoredPath,
  sanitizeFileName,
} from '../attachments/attachment-rules';
import type { UploadedFile } from '../attachments/attachments.service';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_TEMPLATE_PLACEHOLDERS,
  DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS,
} from './document-template.constants';
import { validateDocumentTemplate } from './document-template-validator';
import { BUILTIN_TEMPLATE_PATHS } from './documents.constants';
import { DocxRows, DocxValues, fillDocx } from './lib/fill-docx';

const templateSelect = {
  id: true,
  type: true,
  displayName: true,
  originalName: true,
  sizeBytes: true,
  isActive: true,
  note: true,
  uploadedAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.DocumentTemplateSelect;

@Injectable()
export class DocumentTemplatesService {
  private readonly templatesDir = path.join(
    process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), 'uploads'),
    'document-templates',
  );

  readonly maxUploadMb = Number(process.env.MAX_UPLOAD_MB) > 0
    ? Number(process.env.MAX_UPLOAD_MB)
    : DEFAULT_MAX_UPLOAD_MB;

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    this.assertAdmin(user);
    const templates = await this.prisma.documentTemplate.findMany({
      select: templateSelect,
      orderBy: [{ type: 'asc' }, { uploadedAt: 'desc' }],
    });
    return {
      templates,
      placeholders: DOCUMENT_TEMPLATE_PLACEHOLDERS,
      requiredPlaceholders: DOCUMENT_TEMPLATE_REQUIRED_PLACEHOLDERS,
      maxUploadMb: this.maxUploadMb,
    };
  }

  async upload(
    dto: { type: DocumentTemplateType; displayName: string; note?: string },
    file: UploadedFile | undefined,
    user: AuthUser,
  ) {
    this.assertAdmin(user);
    assertUploadAllowed(file, this.maxUploadMb);
    if (fileExtension(file!.originalname) !== '.docx') {
      throw new BadRequestException('Шаблон должен быть файлом Word в формате .docx');
    }

    const validation = await validateDocumentTemplate(file!.buffer, dto.type);
    const storedName = buildStoredName(file!.originalname);
    const storedPath = resolveStoredPath(this.templatesDir, storedName);
    await mkdir(this.templatesDir, { recursive: true });
    await writeFile(storedPath, file!.buffer, { flag: 'wx' });

    try {
      const template = await this.prisma.$transaction(async (tx) => {
        await tx.documentTemplate.updateMany({
          where: { type: dto.type, isActive: true },
          data: { isActive: false },
        });
        return tx.documentTemplate.create({
          data: {
            type: dto.type,
            displayName: dto.displayName.trim(),
            storedName,
            originalName: sanitizeFileName(file!.originalname),
            sizeBytes: file!.size,
            uploadedByUserId: user.id,
            isActive: true,
            note: dto.note?.trim() || null,
          },
          select: templateSelect,
        });
      });
      return { template, unknownPlaceholders: validation.unknownPlaceholders };
    } catch (error) {
      await unlink(storedPath).catch(() => undefined);
      this.rethrowActivationConflict(error);
    }
  }

  async activate(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const target = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Версия шаблона не найдена');
    const buffer = await this.readUploadedTemplate(target.storedName);
    const validation = await validateDocumentTemplate(buffer, target.type);

    try {
      const template = await this.prisma.$transaction(async (tx) => {
        await tx.documentTemplate.updateMany({
          where: { type: target.type, isActive: true },
          data: { isActive: false },
        });
        return tx.documentTemplate.update({
          where: { id: target.id },
          data: { isActive: true },
          select: templateSelect,
        });
      });
      return { template, unknownPlaceholders: validation.unknownPlaceholders };
    } catch (error) {
      this.rethrowActivationConflict(error);
    }
  }

  async download(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Версия шаблона не найдена');
    return {
      buffer: await this.readUploadedTemplate(template.storedName),
      fileName: template.originalName,
    };
  }

  async downloadFallback(type: DocumentTemplateType, user: AuthUser) {
    this.assertAdmin(user);
    try {
      return {
        buffer: await readFile(BUILTIN_TEMPLATE_PATHS[type]),
        fileName: path.basename(BUILTIN_TEMPLATE_PATHS[type]),
      };
    } catch {
      throw new NotFoundException('Встроенный образец шаблона не найден');
    }
  }

  async remove(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Версия шаблона не найдена');
    if (template.isActive) {
      throw new BadRequestException(
        'Активную версию удалить нельзя — сначала активируйте другую версию',
      );
    }
    const deleted = await this.prisma.documentTemplate.deleteMany({
      where: { id, isActive: false },
    });
    if (deleted.count === 0) {
      throw new BadRequestException(
        'Активную версию удалить нельзя — сначала активируйте другую версию',
      );
    }
    await unlink(resolveStoredPath(this.templatesDir, template.storedName))
      .catch(() => undefined);
    return { ok: true };
  }

  async fillTemplate(
    type: DocumentTemplateType,
    values: DocxValues,
    rows?: DocxRows,
  ): Promise<Buffer> {
    const active = await this.prisma.documentTemplate.findFirst({
      where: { type, isActive: true },
      select: { storedName: true },
    });
    const templatePath = active
      ? resolveStoredPath(this.templatesDir, active.storedName)
      : BUILTIN_TEMPLATE_PATHS[type];
    try {
      return await fillDocx(templatePath, values, rows);
    } catch (error) {
      if (
        error instanceof Error
        && error.message.startsWith('Вложенная таблица внутри повторяемой строки')
      ) {
        throw new InternalServerErrorException(error.message);
      }
      if (active) {
        throw new InternalServerErrorException(
          'Активный шаблон документа повреждён или отсутствует на диске',
        );
      }
      throw new InternalServerErrorException('Встроенный шаблон документа недоступен');
    }
  }

  private assertAdmin(user: AuthUser): void {
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException('Управление шаблонами доступно только администратору');
    }
  }

  private async readUploadedTemplate(storedName: string): Promise<Buffer> {
    try {
      return await readFile(resolveStoredPath(this.templatesDir, storedName));
    } catch {
      throw new NotFoundException('Файл шаблона не найден на диске');
    }
  }

  private rethrowActivationConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Активная версия шаблона уже изменилась — обновите страницу и повторите действие',
      );
    }
    throw error;
  }
}
