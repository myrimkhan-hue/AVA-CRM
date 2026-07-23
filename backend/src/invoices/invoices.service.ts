import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  InvoiceStatus,
  Prisma,
  TaxRateKind,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceContextQueryDto } from './dto/invoice-context-query.dto';
import { InvoiceLineDto } from './dto/invoice-line.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const invoiceInclude = {
  transportation: {
    select: {
      id: true,
      number: true,
      originPoint: true,
      destinationPoint: true,
      deal: {
        select: {
          id: true,
          number: true,
          responsibleId: true,
          departmentId: true,
          responsible: { select: { id: true, fullName: true } },
          department: { select: { id: true, name: true } },
        },
      },
    },
  },
  legalEntity: {
    select: { id: true, name: true, numberingPrefix: true },
  },
  client: { select: { id: true, name: true } },
  currency: { select: { code: true, name: true, isBase: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } },
  payments: {
    where: { deletedAt: null },
    include: { createdBy: { select: { id: true, fullName: true } } },
    orderBy: [{ paymentDate: 'desc' as const }, { createdAt: 'desc' as const }],
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;
type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legalEntitiesService: LegalEntitiesService,
  ) {}

  async findAll(query: InvoiceQueryDto, user: AuthUser) {
    if (query.includeDeleted && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Просмотр удалённых счетов доступен только администратору',
      );
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        AND: [
          this.visibilityWhere(user),
          {
            deletedAt: query.includeDeleted ? undefined : null,
            transportationId: query.transportationId,
            clientId: query.clientId,
            status: query.status,
            legalEntityId: query.legalEntityId,
          },
        ],
      },
      include: invoiceInclude,
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    });
    return invoices.map((invoice) => this.toResponse(invoice));
  }

  async findOne(id: string, user: AuthUser) {
    const invoice = await this.getVisibleInvoice(
      id,
      user,
      user.roles.includes('ADMIN'),
    );
    return this.toResponse(invoice);
  }

  async createContext(query: InvoiceContextQueryDto, user: AuthUser) {
    const issueDate = query.issueDate
      ? this.parseDate(query.issueDate)
      : this.today();
    const transportation = await this.getVisibleTransportation(
      query.transportationId,
      user,
    );
    const deal = transportation.deal;
    const [currencies, vatRate] = await Promise.all([
      this.prisma.currency.findMany({
        where: { isActive: true },
        select: { code: true, name: true, isBase: true },
        orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
      }),
      this.legalEntitiesService.getEffectiveTaxRate(
        deal.legalEntityId,
        TaxRateKind.VAT,
        issueDate,
      ),
    ]);

    const postpaymentDays =
      deal.client.paymentTerm === 'POSTPAYMENT'
        ? (deal.client.postpaymentDays ?? 0)
        : 0;
    const dueDate = new Date(issueDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + postpaymentDays);
    const clientRateCurrency =
      transportation.clientRate !== null
        ? transportation.clientRateCurrency
        : null;
    const suggestedCurrency =
      clientRateCurrency &&
      currencies.some((currency) => currency.code === clientRateCurrency)
        ? clientRateCurrency
        : null;

    return {
      transportation: {
        id: transportation.id,
        number: transportation.number,
        originPoint: transportation.originPoint,
        destinationPoint: transportation.destinationPoint,
        clientRate: transportation.clientRate,
        clientRateCurrency: transportation.clientRateCurrency,
      },
      deal: {
        id: deal.id,
        number: deal.number,
        client: deal.client,
        legalEntity: deal.legalEntity,
      },
      currencies,
      suggested: {
        currencyCode:
          suggestedCurrency ??
          currencies.find((currency) => currency.code === 'KZT')?.code ??
          currencies[0]?.code ??
          null,
        issueDate: this.dateString(issueDate),
        dueDate: this.dateString(dueDate),
        hasVat: vatRate?.isVatPayer === true,
        vatRatePercent:
          vatRate?.isVatPayer === true ? vatRate.ratePercent : null,
        serviceName:
          transportation.clientRate !== null
            ? `${transportation.originPoint} — ${transportation.destinationPoint}`
            : '',
        quantity: 1,
        unitPrice: transportation.clientRate,
      },
    };
  }

  async create(dto: CreateInvoiceDto, user: AuthUser) {
    const transportation = await this.getVisibleTransportation(
      dto.transportationId,
      user,
    );
    const deal = transportation.deal;
    if (this.isManagerOnly(user) && deal.responsibleId !== user.id) {
      throw new ForbiddenException(
        'Менеджер может создавать счета только по перевозкам своих сделок',
      );
    }
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        transportationId: transportation.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingInvoice) {
      throw new ConflictException(
        'Для этой перевозки счёт уже существует',
      );
    }
    const currencyCode = dto.currencyCode.trim().toUpperCase();
    const currency = await this.prisma.currency.findFirst({
      where: { code: currencyCode, isActive: true },
      select: { code: true },
    });
    if (!currency) {
      throw new BadRequestException('Активная валюта счёта не найдена');
    }

    const issueDate = this.parseDate(dto.issueDate);
    const dueDate = this.parseDate(dto.dueDate);
    this.ensureDateOrder(issueDate, dueDate);
    const lines = dto.lines.map((line) => this.normalizeLine(line));
    const year = issueDate.getUTCFullYear();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const sequence = await tx.invoiceNumberSequence.upsert({
            where: {
              legalEntityId_year: {
                legalEntityId: deal.legalEntityId,
                year,
              },
            },
            create: {
              legalEntityId: deal.legalEntityId,
              year,
              lastNumber: 1,
            },
            update: { lastNumber: { increment: 1 } },
          });
          const number = `${deal.legalEntity.numberingPrefix}-${year}-${String(
            sequence.lastNumber,
          ).padStart(4, '0')}`;
          const invoice = await tx.invoice.create({
            data: {
              number,
              transportationId: transportation.id,
              legalEntityId: deal.legalEntityId,
              clientId: deal.clientId,
              currencyCode,
              issueDate,
              dueDate,
              notes: dto.notes?.trim() || null,
              lines: {
                create: lines.map((line, index) => ({
                  ...line,
                  sortOrder: index + 1,
                })),
              },
            },
            include: invoiceInclude,
          });
          await this.writeAudit(
            tx,
            user.id,
            invoice.id,
            AuditAction.CREATE,
            this.creationChanges(invoice),
          );
          return invoice;
        });
        return this.toResponse(created);
      } catch (error: unknown) {
        if (this.isTransportationConflict(error)) {
          throw new ConflictException(
            'Для этой перевозки счёт уже существует',
          );
        }
        if (this.isUniqueConflict(error) && attempt < 3) continue;
        if (this.isUniqueConflict(error)) {
          throw new BadRequestException(
            'Не удалось сформировать уникальный номер счёта',
          );
        }
        throw error;
      }
    }
    throw new BadRequestException('Не удалось создать счёт');
  }

  async update(id: string, dto: UpdateInvoiceDto, user: AuthUser) {
    const current = await this.getActiveVisibleInvoice(id, user);
    const issueDate = dto.issueDate
      ? this.parseDate(dto.issueDate)
      : current.issueDate;
    const dueDate = dto.dueDate
      ? this.parseDate(dto.dueDate)
      : current.dueDate;
    this.ensureDateOrder(issueDate, dueDate);

    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.issueDate !== undefined) data.issueDate = issueDate;
    if (dto.dueDate !== undefined) data.dueDate = dueDate;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data,
        include: invoiceInclude,
      });
      await this.writeAudit(
        tx,
        user.id,
        id,
        AuditAction.UPDATE,
        this.diff(current, invoice),
      );
      return invoice;
    });
    return this.toResponse(updated);
  }

  async addLine(id: string, dto: InvoiceLineDto, user: AuthUser) {
    const current = await this.getActiveVisibleInvoice(id, user);
    const normalized = this.normalizeLine(dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.invoiceLine.aggregate({
        where: { invoiceId: id },
        _max: { sortOrder: true },
      });
      const line = await tx.invoiceLine.create({
        data: {
          invoiceId: id,
          sortOrder: (aggregate._max.sortOrder ?? 0) + 1,
          ...normalized,
        },
      });
      const status = await this.recalculateStatus(tx, id);
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        line: { old: null, new: this.lineSnapshot(line) },
        status: { old: current.status, new: status },
      });
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });
    return this.toResponse(updated);
  }

  async updateLine(
    id: string,
    lineId: string,
    dto: UpdateInvoiceLineDto,
    user: AuthUser,
  ) {
    const current = await this.getActiveVisibleInvoice(id, user);
    const line = current.lines.find((item) => item.id === lineId);
    if (!line) throw new NotFoundException('Позиция счёта не найдена');

    const normalized = this.normalizeLine({
      serviceName: dto.serviceName ?? line.serviceName,
      quantity: dto.quantity ?? line.quantity.toNumber(),
      unitPrice: dto.unitPrice ?? line.unitPrice.toNumber(),
      hasVat: dto.hasVat ?? line.hasVat,
      vatRatePercent:
        dto.vatRatePercent !== undefined
          ? dto.vatRatePercent
          : line.vatRatePercent?.toNumber(),
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const changedLine = await tx.invoiceLine.update({
        where: { id: lineId },
        data: normalized,
      });
      const status = await this.recalculateStatus(tx, id);
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        line: {
          old: this.lineSnapshot(line),
          new: this.lineSnapshot(changedLine),
        },
        status: { old: current.status, new: status },
      });
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });
    return this.toResponse(updated);
  }

  async removeLine(id: string, lineId: string, user: AuthUser) {
    const current = await this.getActiveVisibleInvoice(id, user);
    const line = current.lines.find((item) => item.id === lineId);
    if (!line) throw new NotFoundException('Позиция счёта не найдена');
    if (current.lines.length === 1) {
      throw new BadRequestException(
        'В счёте должна оставаться хотя бы одна позиция',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLine.delete({ where: { id: lineId } });
      const status = await this.recalculateStatus(tx, id);
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        line: { old: this.lineSnapshot(line), new: null },
        status: { old: current.status, new: status },
      });
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });
    return this.toResponse(updated);
  }

  async addPayment(id: string, dto: CreatePaymentDto, user: AuthUser) {
    const current = await this.getActiveVisibleInvoice(id, user);
    const paymentDate = this.parseDate(dto.paymentDate);

    const updated = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: id,
          paymentDate,
          amount: new Prisma.Decimal(dto.amount),
          manualExchangeRate:
            dto.manualExchangeRate !== undefined
              ? new Prisma.Decimal(dto.manualExchangeRate)
              : null,
          note: dto.note?.trim() || null,
          createdByUserId: user.id,
        },
      });
      const status = await this.recalculateStatus(tx, id);
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        payment: { old: null, new: this.paymentSnapshot(payment) },
        status: { old: current.status, new: status },
      });
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });
    return this.toResponse(updated);
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.getVisibleInvoice(id, user, true);
    if (current.deletedAt) {
      throw new BadRequestException('Счёт уже удалён');
    }
    const deleted = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: invoiceInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.DELETE, {
        deletedAt: {
          old: null,
          new: invoice.deletedAt?.toISOString() ?? null,
        },
      });
      return invoice;
    });
    return this.toResponse(deleted);
  }

  private visibilityWhere(user: AuthUser): Prisma.InvoiceWhereInput {
    if (
      user.roles.some((role) =>
        ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role),
      )
    ) {
      return {};
    }
    const conditions: Prisma.TransportationWhereInput[] = [];
    if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
      conditions.push({ deal: { departmentId: user.departmentId } });
    }
    if (user.roles.includes('MANAGER')) {
      conditions.push({ deal: { responsibleId: user.id } });
    }
    return conditions.length
      ? { transportation: { is: { OR: conditions } } }
      : { id: { in: [] } };
  }

  private transportationVisibilityWhere(
    user: AuthUser,
  ): Prisma.TransportationWhereInput {
    if (
      user.roles.some((role) =>
        ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role),
      )
    ) {
      return {};
    }
    const conditions: Prisma.TransportationWhereInput[] = [];
    if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
      conditions.push({ deal: { departmentId: user.departmentId } });
    }
    if (user.roles.includes('MANAGER')) {
      conditions.push({ deal: { responsibleId: user.id } });
    }
    return conditions.length ? { OR: conditions } : { id: { in: [] } };
  }

  private async getVisibleTransportation(id: string, user: AuthUser) {
    const exists = await this.prisma.transportation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Перевозка не найдена');
    const transportation = await this.prisma.transportation.findFirst({
      where: {
        AND: [
          { id, deletedAt: null, deal: { deletedAt: null } },
          this.transportationVisibilityWhere(user),
        ],
      },
      select: {
        id: true,
        number: true,
        originPoint: true,
        destinationPoint: true,
        clientRate: true,
        clientRateCurrency: true,
        deal: {
          select: {
            id: true,
            number: true,
            clientId: true,
            legalEntityId: true,
            responsibleId: true,
            departmentId: true,
            legalEntity: {
              select: { id: true, name: true, numberingPrefix: true },
            },
            client: {
              select: {
                id: true,
                name: true,
                paymentTerm: true,
                postpaymentDays: true,
              },
            },
          },
        },
      },
    });
    if (!transportation) {
      throw new ForbiddenException('Нет доступа к счёту этой перевозки');
    }
    return transportation;
  }

  private async getVisibleInvoice(
    id: string,
    user: AuthUser,
    includeDeleted = false,
  ): Promise<InvoiceWithRelations> {
    const exists = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Счёт не найден');
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        AND: [
          { id },
          this.visibilityWhere(user),
          { deletedAt: includeDeleted ? undefined : null },
        ],
      },
      include: invoiceInclude,
    });
    if (!invoice) throw new ForbiddenException('Нет доступа');
    return invoice;
  }

  private async getActiveVisibleInvoice(id: string, user: AuthUser) {
    const invoice = await this.getVisibleInvoice(id, user, true);
    if (invoice.deletedAt) {
      throw new BadRequestException('Нельзя изменить удалённый счёт');
    }
    return invoice;
  }

  private normalizeLine(line: InvoiceLineDto) {
    const serviceName = line.serviceName.trim();
    if (!serviceName) {
      throw new BadRequestException('Укажите наименование услуги');
    }
    const hasVat = line.hasVat;
    if (hasVat && line.vatRatePercent === undefined) {
      throw new BadRequestException(
        'Для позиции с НДС необходимо указать ставку НДС',
      );
    }
    return {
      serviceName,
      quantity: new Prisma.Decimal(line.quantity),
      unitPrice: new Prisma.Decimal(line.unitPrice),
      hasVat,
      vatRatePercent: hasVat
        ? new Prisma.Decimal(line.vatRatePercent as number)
        : null,
    };
  }

  private async recalculateStatus(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ): Promise<InvoiceStatus> {
    const [lines, payments] = await Promise.all([
      tx.invoiceLine.findMany({ where: { invoiceId } }),
      tx.invoicePayment.findMany({
        where: { invoiceId, deletedAt: null },
        select: { amount: true },
      }),
    ]);
    const total = this.calculateTotals(lines).totalAmount;
    const paid = payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const status =
      paid.isZero()
        ? InvoiceStatus.ISSUED
        : paid.lessThan(total)
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.PAID;
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
    return status;
  }

  private calculateTotals(
    lines: Array<{
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      hasVat: boolean;
      vatRatePercent: Prisma.Decimal | null;
    }>,
  ) {
    return lines.reduce(
      (totals, line) => {
        const netAmount = line.quantity
          .times(line.unitPrice)
          .toDecimalPlaces(2);
        const vatAmount = line.hasVat
          ? netAmount
              .times(line.vatRatePercent ?? 0)
              .dividedBy(100)
              .toDecimalPlaces(2)
          : new Prisma.Decimal(0);
        return {
          netAmount: totals.netAmount.plus(netAmount),
          vatAmount: totals.vatAmount.plus(vatAmount),
          totalAmount: totals.totalAmount.plus(netAmount).plus(vatAmount),
        };
      },
      {
        netAmount: new Prisma.Decimal(0),
        vatAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
      },
    );
  }

  private toResponse(invoice: InvoiceWithRelations) {
    const lines = invoice.lines.map((line) => {
      const totals = this.calculateTotals([line]);
      return { ...line, ...totals };
    });
    const totals = this.calculateTotals(invoice.lines);
    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    return {
      ...invoice,
      lines,
      totals: {
        ...totals,
        paidAmount,
        balanceAmount: Prisma.Decimal.max(
          totals.totalAmount.minus(paidAmount),
          0,
        ),
      },
      isOverdue:
        invoice.status !== InvoiceStatus.PAID &&
        invoice.dueDate.getTime() < this.today().getTime(),
    };
  }

  private parseDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private today(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private dateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private ensureDateOrder(issueDate: Date, dueDate: Date): void {
    if (dueDate.getTime() < issueDate.getTime()) {
      throw new BadRequestException(
        'Срок оплаты не может быть раньше даты счёта',
      );
    }
  }

  private isManagerOnly(user: AuthUser): boolean {
    return (
      user.roles.includes('MANAGER') &&
      !user.roles.some((role) =>
        ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'FINANCIER'].includes(role),
      )
    );
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isTransportationConflict(error: unknown): boolean {
    if (!this.isUniqueConflict(error)) return false;
    const target = (error as Prisma.PrismaClientKnownRequestError).meta
      ?.target;
    return Array.isArray(target)
      ? target.includes('transportation_id')
      : String(target ?? '').includes('transportation_id');
  }

  private creationChanges(invoice: InvoiceWithRelations): Changes {
    const changes: Changes = {};
    for (const [key, value] of Object.entries(this.snapshot(invoice))) {
      changes[key] = { old: null, new: value };
    }
    return changes;
  }

  private diff(
    current: InvoiceWithRelations,
    updated: InvoiceWithRelations,
  ): Changes {
    const before = this.snapshot(current);
    const after = this.snapshot(updated);
    const changes: Changes = {};
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = { old: before[key], new: after[key] };
      }
    }
    return changes;
  }

  private snapshot(invoice: InvoiceWithRelations): Record<string, unknown> {
    return {
      number: invoice.number,
      transportationId: invoice.transportationId,
      legalEntityId: invoice.legalEntityId,
      clientId: invoice.clientId,
      currencyCode: invoice.currencyCode,
      issueDate: this.dateString(invoice.issueDate),
      dueDate: this.dateString(invoice.dueDate),
      status: invoice.status,
      notes: invoice.notes,
      lines: invoice.lines.map((line) => this.lineSnapshot(line)),
      deletedAt: invoice.deletedAt?.toISOString() ?? null,
    };
  }

  private lineSnapshot(line: {
    id: string;
    sortOrder: number;
    serviceName: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    hasVat: boolean;
    vatRatePercent: Prisma.Decimal | null;
  }) {
    return {
      id: line.id,
      sortOrder: line.sortOrder,
      serviceName: line.serviceName,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      hasVat: line.hasVat,
      vatRatePercent: line.vatRatePercent?.toString() ?? null,
    };
  }

  private paymentSnapshot(payment: {
    id: string;
    paymentDate: Date;
    amount: Prisma.Decimal;
    manualExchangeRate: Prisma.Decimal | null;
    note: string | null;
    createdByUserId: string;
  }) {
    return {
      id: payment.id,
      paymentDate: this.dateString(payment.paymentDate),
      amount: payment.amount.toString(),
      manualExchangeRate: payment.manualExchangeRate?.toString() ?? null,
      note: payment.note,
      createdByUserId: payment.createdByUserId,
    };
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
        entityType: 'Invoice',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }
}
