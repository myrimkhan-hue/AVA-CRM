import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentEntityType, Prisma } from '@prisma/client';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { AuthUser } from '../auth/auth-user.type';
import { dealVisibilityWhere } from '../deals/deal-policy';
import { invoiceVisibilityWhere } from '../invoices/invoice-policy';
import { PrismaService } from '../prisma/prisma.service';
import { transportationVisibilityWhere } from '../transportations/transportation-policy';
import {
  assertUploadAllowed,
  buildStoredName,
  DEFAULT_MAX_UPLOAD_MB,
  resolveStoredPath,
  sanitizeFileName,
} from './attachment-rules';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const attachmentSelect = {
  id: true,
  entityType: true,
  entityId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  description: true,
  uploadedAt: true,
  uploadedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AttachmentSelect;

@Injectable()
export class AttachmentsService {
  private readonly uploadsDir =
    process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), 'uploads');

  readonly maxUploadMb = Number(process.env.MAX_UPLOAD_MB) > 0
    ? Number(process.env.MAX_UPLOAD_MB)
    : DEFAULT_MAX_UPLOAD_MB;

  constructor(private readonly prisma: PrismaService) {}

  async list(entityType: AttachmentEntityType, entityId: string, user: AuthUser) {
    await this.assertCanAccessEntity(entityType, entityId, user);
    return this.prisma.attachment.findMany({
      where: { entityType, entityId, deletedAt: null },
      select: attachmentSelect,
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async upload(
    entityType: AttachmentEntityType,
    entityId: string,
    file: UploadedFile | undefined,
    description: string | undefined,
    user: AuthUser,
  ) {
    await this.assertCanAccessEntity(entityType, entityId, user);
    assertUploadAllowed(file, this.maxUploadMb);
    const uploaded = file!;

    const storedName = buildStoredName(uploaded.originalname);
    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(resolveStoredPath(this.uploadsDir, storedName), uploaded.buffer);

    return this.prisma.attachment.create({
      data: {
        entityType,
        entityId,
        fileName: sanitizeFileName(uploaded.originalname),
        storedName,
        mimeType: uploaded.mimetype || 'application/octet-stream',
        sizeBytes: uploaded.size,
        description: description?.trim() || null,
        uploadedById: user.id,
      },
      select: attachmentSelect,
    });
  }

  async download(id: string, user: AuthUser): Promise<{ buffer: Buffer; fileName: string }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Файл не найден');
    await this.assertCanAccessEntity(attachment.entityType, attachment.entityId, user);

    try {
      const buffer = await readFile(resolveStoredPath(this.uploadsDir, attachment.storedName));
      return { buffer, fileName: attachment.fileName };
    } catch {
      throw new NotFoundException('Файл не найден на диске — возможно, он был удалён вне системы');
    }
  }

  /**
   * Удаление мягкое: запись помечается удалённой, файл с диска стирается.
   * Так в журнале остаётся след, кто и что прикладывал.
   */
  async remove(id: string, user: AuthUser) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, deletedAt: null } });
    if (!attachment) throw new NotFoundException('Файл не найден');
    await this.assertCanAccessEntity(attachment.entityType, attachment.entityId, user);
    const isPrivileged = user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role));
    if (!isPrivileged && attachment.uploadedById !== user.id) {
      throw new ForbiddenException('Удалить файл может тот, кто его загрузил, либо администратор');
    }

    const removed = await this.prisma.attachment.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: attachmentSelect,
    });
    await unlink(resolveStoredPath(this.uploadsDir, attachment.storedName)).catch(() => undefined);
    return removed;
  }

  /**
   * Доступ к вложению наследуется от карточки, к которой оно приложено:
   * если пользователь не видит сделку — он не видит и её файлы.
   */
  private async assertCanAccessEntity(
    entityType: AttachmentEntityType,
    entityId: string,
    user: AuthUser,
  ): Promise<void> {
    const found = await this.findVisibleEntity(entityType, entityId, user);
    if (!found) throw new ForbiddenException('Нет доступа к этой карточке');
  }

  private async findVisibleEntity(
    entityType: AttachmentEntityType,
    entityId: string,
    user: AuthUser,
  ): Promise<{ id: string } | null> {
    switch (entityType) {
      case AttachmentEntityType.DEAL:
        return this.prisma.deal.findFirst({
          where: { AND: [{ id: entityId, deletedAt: null }, dealVisibilityWhere(user)] },
          select: { id: true },
        });
      case AttachmentEntityType.TRANSPORTATION:
        return this.prisma.transportation.findFirst({
          where: {
            AND: [
              { id: entityId, deletedAt: null, deal: { deletedAt: null } },
              transportationVisibilityWhere(user),
            ],
          },
          select: { id: true },
        });
      case AttachmentEntityType.INVOICE:
        return this.prisma.invoice.findFirst({
          where: { AND: [{ id: entityId, deletedAt: null }, invoiceVisibilityWhere(user)] },
          select: { id: true },
        });
      case AttachmentEntityType.PAYMENT_REQUEST:
        return this.prisma.paymentRequest.findFirst({
          where: {
            AND: [
              { id: entityId, deletedAt: null },
              { transportation: { is: transportationVisibilityWhere(user) } },
            ],
          },
          select: { id: true },
        });
      case AttachmentEntityType.CONTRACTOR:
        // Справочник контрагентов виден всем сотрудникам (ограничений по ролям нет).
        return this.prisma.contractor.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { id: true },
        });
      default:
        // Неизвестный тип — доступ закрыт, а не открыт.
        throw new BadRequestException('Неизвестный тип карточки для вложения');
    }
  }
}
