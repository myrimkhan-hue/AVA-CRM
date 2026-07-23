import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.currency.findMany({
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    });
  }

  async create(dto: CreateCurrencyDto, actorUserId: string) {
    const data = {
      code: dto.code,
      name: dto.name.trim(),
      isBase: false,
    };
    if (data.code === 'KZT') {
      throw new ConflictException('Валюта KZT уже является базовой валютой');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currency = await tx.currency.create({ data });
        await this.writeAudit(
          tx,
          actorUserId,
          currency.code,
          AuditAction.CREATE,
          {
            code: { old: null, new: currency.code },
            name: { old: null, new: currency.name },
            isBase: { old: null, new: currency.isBase },
            isActive: { old: null, new: currency.isActive },
          },
        );
        return currency;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Валюта с таким кодом уже существует');
      }
      throw error;
    }
  }

  async update(code: string, dto: UpdateCurrencyDto, actorUserId: string) {
    const currencyCode = code.trim().toUpperCase();
    const current = await this.getByCode(currencyCode);
    const data: Prisma.CurrencyUpdateInput = {};
    const changes: Changes = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      changes.name = { old: current.name, new: data.name };
    }
    if (dto.isActive !== undefined) {
      if (current.isBase && !dto.isActive) {
        throw new BadRequestException(
          'Базовую валюту KZT нельзя деактивировать',
        );
      }
      data.isActive = dto.isActive;
      changes.isActive = { old: current.isActive, new: dto.isActive };
    }
    if (!Object.keys(changes).length) {
      throw new BadRequestException('Не указаны поля для изменения');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.currency.update({
        where: { code: currencyCode },
        data,
      });
      await this.writeAudit(
        tx,
        actorUserId,
        currencyCode,
        AuditAction.UPDATE,
        changes,
      );
      return updated;
    });
  }

  async getByCode(code: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!currency) {
      throw new NotFoundException('Валюта не найдена');
    }
    return currency;
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
        entityType: 'Currency',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }
}
