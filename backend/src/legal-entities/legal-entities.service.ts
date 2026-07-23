import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  TaxRateKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';

type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class LegalEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.legalEntity.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateLegalEntityDto, actorUserId: string) {
    const data = {
      name: dto.name.trim(),
      numberingPrefix: dto.numberingPrefix.trim().toUpperCase(),
      bin: dto.bin?.trim() || null,
      legalAddress: dto.legalAddress?.trim() || null,
      taxRegime: dto.taxRegime,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const legalEntity = await tx.legalEntity.create({ data });
        await this.writeAudit(
          tx,
          actorUserId,
          legalEntity.id,
          AuditAction.CREATE,
          Object.fromEntries(
            Object.entries(data).map(([field, value]) => [
              field,
              { old: null, new: value },
            ]),
          ),
        );
        return legalEntity;
      });
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateLegalEntityDto,
    actorUserId: string,
  ) {
    const current = await this.getLegalEntity(id);
    const data: Prisma.LegalEntityUpdateInput = {};
    const changes: Changes = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      changes.name = { old: current.name, new: data.name };
    }
    if (dto.bin !== undefined) {
      data.bin = dto.bin?.trim() || null;
      changes.bin = { old: current.bin, new: data.bin };
    }
    if (dto.legalAddress !== undefined) {
      data.legalAddress = dto.legalAddress?.trim() || null;
      changes.legalAddress = {
        old: current.legalAddress,
        new: data.legalAddress,
      };
    }
    if (dto.taxRegime !== undefined) {
      data.taxRegime = dto.taxRegime;
      changes.taxRegime = {
        old: current.taxRegime,
        new: dto.taxRegime,
      };
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      changes.isActive = { old: current.isActive, new: dto.isActive };
    }
    if (!Object.keys(changes).length) {
      throw new BadRequestException('Не указаны поля для изменения');
    }

    return this.prisma.$transaction(async (tx) => {
      const legalEntity = await tx.legalEntity.update({
        where: { id },
        data,
      });
      await this.writeAudit(
        tx,
        actorUserId,
        id,
        AuditAction.UPDATE,
        changes,
      );
      return legalEntity;
    });
  }

  async findTaxRates(id: string) {
    await this.getLegalEntity(id);
    return this.prisma.legalEntityTaxRate.findMany({
      where: { legalEntityId: id },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createTaxRate(
    legalEntityId: string,
    dto: CreateTaxRateDto,
    actorUserId: string,
  ) {
    await this.getLegalEntity(legalEntityId);
    if (dto.kind === TaxRateKind.VAT && dto.isVatPayer === undefined) {
      throw new BadRequestException(
        'Для ставки НДС укажите признак плательщика НДС',
      );
    }
    if (dto.kind === TaxRateKind.INCOME_TAX && dto.isVatPayer !== undefined) {
      throw new BadRequestException(
        'Признак плательщика НДС применяется только к ставке НДС',
      );
    }

    const data = {
      legalEntityId,
      kind: dto.kind,
      ratePercent: new Prisma.Decimal(dto.ratePercent),
      isVatPayer:
        dto.kind === TaxRateKind.VAT ? (dto.isVatPayer ?? false) : null,
      effectiveFrom: this.toDate(dto.effectiveFrom),
      note: dto.note?.trim() || null,
      createdByUserId: actorUserId,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const taxRate = await tx.legalEntityTaxRate.create({ data });
        await this.writeAudit(
          tx,
          actorUserId,
          legalEntityId,
          AuditAction.CREATE,
          {
            taxRate: {
              old: null,
              new: {
                id: taxRate.id,
                kind: taxRate.kind,
                ratePercent: taxRate.ratePercent.toString(),
                isVatPayer: taxRate.isVatPayer,
                effectiveFrom: this.toDateOnly(taxRate.effectiveFrom),
                note: taxRate.note,
              },
            },
          },
        );
        return taxRate;
      });
    } catch (error: unknown) {
      this.handlePrismaError(error, true);
    }
  }

  async getEffectiveTaxRate(
    legalEntityId: string,
    kind: TaxRateKind,
    date: Date,
  ): Promise<{ ratePercent: Prisma.Decimal; isVatPayer: boolean | null } | null> {
    const taxRate = await this.prisma.legalEntityTaxRate.findFirst({
      where: {
        legalEntityId,
        kind,
        effectiveFrom: { lte: date },
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { ratePercent: true, isVatPayer: true },
    });
    return taxRate;
  }

  private async getLegalEntity(id: string) {
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id },
    });
    if (!legalEntity) {
      throw new NotFoundException('Юрлицо не найдено');
    }
    return legalEntity;
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    entityId: string,
    action: AuditAction,
    changes: Changes,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: 'LegalEntity',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private toDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private handlePrismaError(error: unknown, taxRate = false): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        taxRate
          ? 'Ставка этого вида с такой датой начала действия уже существует'
          : 'Юрлицо с таким префиксом нумерации уже существует',
      );
    }
    throw error;
  }
}
