import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentPaymentTextType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentPaymentTextDto } from './dto/create-document-payment-text.dto';
import { UpdateDocumentPaymentTextDto } from './dto/update-document-payment-text.dto';

const paymentTextOrder = [
  { type: 'asc' as const },
  { sortOrder: 'asc' as const },
  { shortName: 'asc' as const },
];

@Injectable()
export class DocumentPaymentTextsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    this.assertAdmin(user);
    return this.prisma.documentPaymentText.findMany({ orderBy: paymentTextOrder });
  }

  async activeOptions() {
    const items = await this.prisma.documentPaymentText.findMany({
      where: { isActive: true },
      orderBy: paymentTextOrder,
    });
    const defaults: Record<
      DocumentPaymentTextType,
      (typeof items)[number] | null
    > = {
      [DocumentPaymentTextType.PAYMENT_METHOD]: null,
      [DocumentPaymentTextType.PAYMENT_CONDITIONS]: null,
    };
    for (const item of items) {
      if (item.isDefault) defaults[item.type] = item;
    }
    return { items, defaults };
  }

  async create(dto: CreateDocumentPaymentTextDto, user: AuthUser) {
    this.assertAdmin(user);
    const isActive = dto.isActive ?? true;
    const isDefault = dto.isDefault ?? false;
    this.assertDefaultIsActive(isDefault, isActive);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.documentPaymentText.updateMany({
            where: { type: dto.type, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.documentPaymentText.create({
          data: {
            type: dto.type,
            shortName: dto.shortName.trim(),
            text: dto.text.trim(),
            sortOrder: dto.sortOrder ?? 0,
            isDefault,
            isActive,
          },
        });
      });
    } catch (error) {
      this.rethrowDefaultConflict(error);
    }
  }

  async update(id: string, dto: UpdateDocumentPaymentTextDto, user: AuthUser) {
    this.assertAdmin(user);
    const current = await this.prisma.documentPaymentText.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Формулировка не найдена');

    const type = dto.type ?? current.type;
    const isActive = dto.isActive ?? current.isActive;
    const isDefault = isActive && (dto.isDefault ?? current.isDefault);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.documentPaymentText.updateMany({
            where: { type, isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }
        return tx.documentPaymentText.update({
          where: { id },
          data: {
            type: dto.type,
            shortName: dto.shortName?.trim(),
            text: dto.text?.trim(),
            sortOrder: dto.sortOrder,
            isDefault,
            isActive,
          },
        });
      });
    } catch (error) {
      this.rethrowDefaultConflict(error);
    }
  }

  private assertAdmin(user: AuthUser): void {
    if (!user.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Управление формулировками оплаты доступно только администратору',
      );
    }
  }

  private assertDefaultIsActive(isDefault: boolean, isActive: boolean): void {
    if (isDefault && !isActive) {
      throw new BadRequestException(
        'Значение по умолчанию должно быть активным',
      );
    }
  }

  private rethrowDefaultConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Значение по умолчанию уже изменилось — обновите страницу и повторите действие',
      );
    }
    throw error;
  }
}
