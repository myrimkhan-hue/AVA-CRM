import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import { CreateOperatingExpenseTypeDto } from './dto/create-operating-expense-type.dto';
import { OperatingExpenseQueryDto } from './dto/operating-expense-query.dto';
import { PayOperatingExpenseDto } from './dto/pay-operating-expense.dto';
import { UpdateOperatingExpenseDto } from './dto/update-operating-expense.dto';
import { UpdateOperatingExpenseTypeDto } from './dto/update-operating-expense-type.dto';
import { nextMonthlyDueDate } from './recurrence-date';

type Changes = Record<string, { old: unknown; new: unknown }>;

const expenseInclude = {
  type: true,
  legalEntity: { select: { id: true, name: true } },
  currency: { select: { code: true, name: true, isBase: true } },
  createdBy: { select: { id: true, fullName: true } },
  paidBy: { select: { id: true, fullName: true } },
} satisfies Prisma.OperatingExpenseInclude;

type ExpenseWithRelations = Prisma.OperatingExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

@Injectable()
export class OperatingExpensesService {
  private readonly logger = new Logger(OperatingExpensesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAllTypes() {
    return this.prisma.operatingExpenseType.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createType(dto: CreateOperatingExpenseTypeDto, actorUserId: string) {
    const name = dto.name.trim();
    const isActive = dto.isActive ?? true;
    if (isActive) await this.assertTypeNameAvailable(name);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.operatingExpenseType.create({
          data: { name, sortOrder: dto.sortOrder ?? 0, isActive },
        });
        await this.writeAudit(tx, actorUserId, 'OperatingExpenseType', created.id, AuditAction.CREATE, {
          name: { old: null, new: created.name },
          sortOrder: { old: null, new: created.sortOrder },
          isActive: { old: null, new: created.isActive },
        });
        return created;
      });
    } catch (error) {
      this.rethrowTypeNameConflict(error);
    }
  }

  async updateType(
    id: string,
    dto: UpdateOperatingExpenseTypeDto,
    actorUserId: string,
  ) {
    const current = await this.getType(id);
    const data: Prisma.OperatingExpenseTypeUpdateInput = {};
    const changes: Changes = {};
    const name = dto.name?.trim();
    const activeAfterUpdate = dto.isActive ?? current.isActive;

    if (name !== undefined) {
      data.name = name;
      changes.name = { old: current.name, new: name };
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
      changes.sortOrder = { old: current.sortOrder, new: dto.sortOrder };
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      changes.isActive = { old: current.isActive, new: dto.isActive };
    }
    if (!Object.keys(changes).length) {
      throw new BadRequestException('Не указаны поля для изменения типа расхода');
    }
    if (activeAfterUpdate && (name !== undefined || !current.isActive)) {
      await this.assertTypeNameAvailable(name ?? current.name, id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.operatingExpenseType.update({ where: { id }, data });
        await this.writeAudit(tx, actorUserId, 'OperatingExpenseType', id, AuditAction.UPDATE, changes);
        return updated;
      });
    } catch (error) {
      this.rethrowTypeNameConflict(error);
    }
  }

  async removeType(id: string, actorUserId: string) {
    const current = await this.getType(id);
    const references = await this.prisma.operatingExpense.count({ where: { typeId: id } });
    if (references > 0) {
      throw new ConflictException(
        'Тип расходов уже используется. Удалить его нельзя — деактивируйте тип.',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      const removed = await tx.operatingExpenseType.update({
        where: { id },
        data: { isActive: false, deletedAt },
      });
      await this.writeAudit(tx, actorUserId, 'OperatingExpenseType', id, AuditAction.DELETE, {
        deletedAt: { old: current.deletedAt?.toISOString() ?? null, new: deletedAt.toISOString() },
      });
      return removed;
    });
  }

  async getContext() {
    const [types, legalEntities, currencies] = await Promise.all([
      this.prisma.operatingExpenseType.findMany({
        where: { deletedAt: null },
        orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.legalEntity.findMany({
        where: { isActive: true },
        select: { id: true, name: true, numberingPrefix: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.currency.findMany({
        where: { isActive: true },
        orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
      }),
    ]);
    return { types, legalEntities, currencies };
  }

  async findAll(query: OperatingExpenseQueryDto) {
    const dueDateFrom = query.dueDateFrom ? this.toDate(query.dueDateFrom) : undefined;
    const dueDateTo = query.dueDateTo ? this.toDate(query.dueDateTo) : undefined;
    if (dueDateFrom && dueDateTo && dueDateTo.getTime() < dueDateFrom.getTime()) {
      throw new BadRequestException('Дата окончания периода раньше даты начала');
    }
    const where: Prisma.OperatingExpenseWhereInput = {
      deletedAt: null,
      typeId: query.typeId,
      legalEntityId: query.legalEntityId,
      dueDate: dueDateFrom || dueDateTo ? { gte: dueDateFrom, lte: dueDateTo } : undefined,
      paidAt: query.paid === undefined ? undefined : query.paid ? { not: null } : null,
    };
    const rows = await this.prisma.operatingExpense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(dto: CreateOperatingExpenseDto, actorUserId: string) {
    const currencyCode = dto.currencyCode.trim().toUpperCase();
    await this.assertReferences(dto.typeId, dto.legalEntityId, currencyCode);
    const data = {
      typeId: dto.typeId,
      legalEntityId: dto.legalEntityId,
      amount: new Prisma.Decimal(dto.amount),
      currencyCode,
      dueDate: this.toDate(dto.dueDate),
      purpose: dto.purpose.trim(),
      isRecurringMonthly: dto.isRecurringMonthly ?? false,
      createdByUserId: actorUserId,
    };
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatingExpense.create({ data, include: expenseInclude });
      await this.writeAudit(tx, actorUserId, 'OperatingExpense', row.id, AuditAction.CREATE,
        this.createChanges(this.snapshot(row)));
      return row;
    });
    return this.toResponse(created);
  }

  async update(id: string, dto: UpdateOperatingExpenseDto, actorUserId: string) {
    const current = await this.getExpense(id);
    const data: Prisma.OperatingExpenseUncheckedUpdateInput = {};
    const changes: Changes = {};

    if (dto.typeId !== undefined) {
      data.typeId = dto.typeId;
      changes.typeId = { old: current.typeId, new: dto.typeId };
    }
    if (dto.legalEntityId !== undefined) {
      data.legalEntityId = dto.legalEntityId;
      changes.legalEntityId = { old: current.legalEntityId, new: dto.legalEntityId };
    }
    if (dto.amount !== undefined) {
      data.amount = new Prisma.Decimal(dto.amount);
      changes.amount = { old: current.amount.toString(), new: data.amount.toString() };
    }
    if (dto.currencyCode !== undefined) {
      data.currencyCode = dto.currencyCode.trim().toUpperCase();
      changes.currencyCode = { old: current.currencyCode, new: data.currencyCode };
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = this.toDate(dto.dueDate);
      changes.dueDate = { old: this.dateString(current.dueDate), new: dto.dueDate.slice(0, 10) };
    }
    if (dto.purpose !== undefined) {
      data.purpose = dto.purpose.trim();
      changes.purpose = { old: current.purpose, new: data.purpose };
    }
    if (dto.isRecurringMonthly !== undefined) {
      data.isRecurringMonthly = dto.isRecurringMonthly;
      changes.isRecurringMonthly = { old: current.isRecurringMonthly, new: dto.isRecurringMonthly };
    }
    if (!Object.keys(changes).length) {
      throw new BadRequestException('Не указаны поля для изменения расхода');
    }

    await this.assertReferences(
      dto.typeId !== undefined && dto.typeId !== current.typeId ? dto.typeId : undefined,
      dto.legalEntityId !== undefined && dto.legalEntityId !== current.legalEntityId
        ? dto.legalEntityId
        : undefined,
      dto.currencyCode !== undefined
        && dto.currencyCode.trim().toUpperCase() !== current.currencyCode
        ? dto.currencyCode.trim().toUpperCase()
        : undefined,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatingExpense.update({ where: { id }, data, include: expenseInclude });
      await this.writeAudit(tx, actorUserId, 'OperatingExpense', id, AuditAction.UPDATE, changes);
      return row;
    });
    return this.toResponse(updated);
  }

  async remove(id: string, actorUserId: string) {
    const current = await this.getExpense(id);
    const deletedAt = new Date();
    const removed = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatingExpense.update({
        where: { id },
        data: { deletedAt, isRecurringMonthly: false },
        include: expenseInclude,
      });
      await this.writeAudit(tx, actorUserId, 'OperatingExpense', id, AuditAction.DELETE, {
        deletedAt: { old: null, new: deletedAt.toISOString() },
        isRecurringMonthly: { old: current.isRecurringMonthly, new: false },
      });
      return row;
    });
    return this.toResponse(removed);
  }

  async pay(id: string, dto: PayOperatingExpenseDto, actorUserId: string) {
    const current = await this.getExpense(id);
    if (current.paidAt) throw new BadRequestException('Расход уже отмечен оплаченным');
    const paidAt = this.toDate(dto.paidAt);
    if (paidAt.getTime() > this.today().getTime()) {
      throw new BadRequestException('Дата оплаты не может быть в будущем');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatingExpense.update({
        where: { id },
        data: { paidAt, paidByUserId: actorUserId },
        include: expenseInclude,
      });
      await this.writeAudit(tx, actorUserId, 'OperatingExpense', id, AuditAction.UPDATE, {
        paidAt: { old: null, new: this.dateString(paidAt) },
        paidByUserId: { old: null, new: actorUserId },
      });
      return row;
    });
    return this.toResponse(updated);
  }

  async unpay(id: string, actorUserId: string) {
    const current = await this.getExpense(id);
    if (!current.paidAt) throw new BadRequestException('Расход не отмечен оплаченным');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatingExpense.update({
        where: { id },
        data: { paidAt: null, paidByUserId: null },
        include: expenseInclude,
      });
      await this.writeAudit(tx, actorUserId, 'OperatingExpense', id, AuditAction.UPDATE, {
        paidAt: { old: this.dateString(current.paidAt!), new: null },
        paidByUserId: { old: current.paidByUserId, new: null },
      });
      return row;
    });
    return this.toResponse(updated);
  }

  @Cron('0 15 1 * * *', { timeZone: 'Asia/Almaty', waitForCompletion: true })
  async generateMonthlyRecurringExpenses(now = new Date()): Promise<number> {
    const today = this.today(now);
    const candidates = await this.prisma.operatingExpense.findMany({
      where: {
        deletedAt: null,
        isRecurringMonthly: true,
        recurringSourceId: null,
        dueDate: { lte: today },
      },
      orderBy: { dueDate: 'asc' },
    });
    let createdCount = 0;
    for (const candidate of candidates) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const source = await tx.operatingExpense.findFirst({
            where: {
              id: candidate.id,
              deletedAt: null,
              isRecurringMonthly: true,
              recurringSourceId: null,
              dueDate: { lte: today },
            },
          });
          if (!source) return false;
          const latestCopy = await tx.operatingExpense.findFirst({
            where: { recurringSourceId: source.id },
            orderBy: { dueDate: 'desc' },
          });
          const latestDueDate = latestCopy?.dueDate ?? source.dueDate;
          if (latestDueDate.getTime() > today.getTime()) return false;
          const dueDate = nextMonthlyDueDate(
            latestDueDate,
            source.dueDate.getUTCDate(),
          );
          const copy = await tx.operatingExpense.create({
            data: {
              typeId: source.typeId,
              legalEntityId: source.legalEntityId,
              amount: source.amount,
              currencyCode: source.currencyCode,
              dueDate,
              purpose: source.purpose,
              isRecurringMonthly: false,
              paidAt: null,
              paidByUserId: null,
              createdByUserId: source.createdByUserId,
              recurringSourceId: source.id,
            },
          });
          await this.writeAudit(tx, null, 'OperatingExpense', copy.id, AuditAction.CREATE, {
            recurringSourceId: { old: null, new: source.id },
            dueDate: { old: null, new: this.dateString(dueDate) },
          });
          return true;
        });
        if (created) createdCount += 1;
      } catch (error) {
        if (this.isUniqueError(error)) continue;
        this.logger.error(
          `Не удалось создать повтор операционного расхода ${candidate.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return createdCount;
  }

  private async getType(id: string) {
    const row = await this.prisma.operatingExpenseType.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Тип операционного расхода не найден');
    return row;
  }

  private async getExpense(id: string): Promise<ExpenseWithRelations> {
    const row = await this.prisma.operatingExpense.findFirst({
      where: { id, deletedAt: null },
      include: expenseInclude,
    });
    if (!row) throw new NotFoundException('Операционный расход не найден');
    return row;
  }

  private async assertTypeNameAvailable(name: string, exceptId?: string) {
    const duplicate = await this.prisma.operatingExpenseType.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        id: exceptId ? { not: exceptId } : undefined,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Активный тип расхода с таким названием уже существует');
  }

  private async assertReferences(typeId?: string, legalEntityId?: string, currencyCode?: string) {
    const [type, legalEntity, currency] = await Promise.all([
      typeId
        ? this.prisma.operatingExpenseType.findFirst({ where: { id: typeId, deletedAt: null, isActive: true } })
        : Promise.resolve(null),
      legalEntityId
        ? this.prisma.legalEntity.findFirst({ where: { id: legalEntityId, isActive: true } })
        : Promise.resolve(null),
      currencyCode
        ? this.prisma.currency.findFirst({ where: { code: currencyCode, isActive: true } })
        : Promise.resolve(null),
    ]);
    if (typeId && !type) throw new BadRequestException('Выбранный тип расхода не найден или деактивирован');
    if (legalEntityId && !legalEntity) throw new BadRequestException('Выбранное юрлицо не найдено или деактивировано');
    if (currencyCode && !currency) throw new BadRequestException('Выбранная валюта не найдена или деактивирована');
  }

  private snapshot(row: ExpenseWithRelations): Record<string, unknown> {
    return {
      typeId: row.typeId,
      legalEntityId: row.legalEntityId,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      dueDate: this.dateString(row.dueDate),
      purpose: row.purpose,
      isRecurringMonthly: row.isRecurringMonthly,
      paidAt: row.paidAt ? this.dateString(row.paidAt) : null,
      paidByUserId: row.paidByUserId,
      recurringSourceId: row.recurringSourceId,
    };
  }

  private createChanges(snapshot: Record<string, unknown>): Changes {
    return Object.fromEntries(
      Object.entries(snapshot).map(([field, value]) => [field, { old: null, new: value }]),
    );
  }

  private toResponse(row: ExpenseWithRelations) {
    const today = this.today();
    return {
      ...row,
      amount: row.amount.toString(),
      dueDate: this.dateString(row.dueDate),
      paidAt: row.paidAt ? this.dateString(row.paidAt) : null,
      isOverdue: !row.paidAt && row.dueDate.getTime() < today.getTime(),
    };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string | null,
    entityType: string,
    entityId: string,
    action: AuditAction,
    changes: Changes,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType,
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private rethrowTypeNameConflict(error: unknown): never {
    if (this.isUniqueError(error)) {
      throw new ConflictException('Активный тип расхода с таким названием уже существует');
    }
    throw error;
  }

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private toDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private dateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private today(now = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
  }
}
