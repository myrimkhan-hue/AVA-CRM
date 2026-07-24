import { Injectable } from '@nestjs/common';
import { GeneratedDocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocxValues, fillDocx } from './lib/fill-docx';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Уникальный номер документа на базе ключа (обычно уже содержит дату,
   * например "TT-EX-2407/2026"). Первый документ с таким ключом получает
   * номер как есть, второй за тот же день — суффикс "/2" и так далее.
   */
  async nextDocumentNumber(baseKey: string): Promise<string> {
    const counter = await this.prisma.documentNumberCounter.upsert({
      where: { key: baseKey },
      create: { key: baseKey, count: 1 },
      update: { count: { increment: 1 } },
    });
    return counter.count <= 1 ? baseKey : `${baseKey}/${counter.count}`;
  }

  async fillTemplate(templatePath: string, values: DocxValues): Promise<Buffer> {
    return fillDocx(templatePath, values);
  }

  async logGeneration(params: {
    type: GeneratedDocumentType;
    number: string;
    dealId?: string;
    transportationId?: string;
    userId: string;
  }) {
    return this.prisma.generatedDocument.create({
      data: {
        type: params.type,
        number: params.number,
        dealId: params.dealId,
        transportationId: params.transportationId,
        generatedByUserId: params.userId,
      },
    });
  }

  async history(params: { dealId?: string; transportationId?: string }) {
    return this.prisma.generatedDocument.findMany({
      where: {
        dealId: params.dealId,
        transportationId: params.transportationId,
      },
      include: { generatedBy: { select: { id: true, fullName: true } } },
      orderBy: { generatedAt: 'desc' },
    });
  }
}
