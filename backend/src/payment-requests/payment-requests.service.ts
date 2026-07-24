import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PaymentRequestStatus,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { transportationVisibilityWhere } from '../transportations/transportation-policy';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PayPaymentRequestDto } from './dto/pay-payment-request.dto';
import { PaymentRequestContextQueryDto } from './dto/payment-request-context-query.dto';
import { PaymentRequestQueryDto } from './dto/payment-request-query.dto';
import { ReissuePaymentRequestDto } from './dto/reissue-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';

const paymentRequestInclude = {
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
          legalEntityId: true,
          legalEntity: { select: { id: true, name: true } },
        },
      },
      logist: { select: { id: true, fullName: true } },
    },
  },
  leg: {
    select: {
      id: true,
      orderIndex: true,
      fromPoint: true,
      toPoint: true,
    },
  },
  payeeContractor: { select: { id: true, name: true, types: true } },
  currency: { select: { code: true, name: true, isBase: true } },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  paidBy: { select: { id: true, fullName: true } },
  payerLegalEntity: { select: { id: true, name: true } },
  reimbursementInvoice: { select: { id: true, number: true } },
} satisfies Prisma.PaymentRequestInclude;

type PaymentRequestWithRelations = Prisma.PaymentRequestGetPayload<{
  include: typeof paymentRequestInclude;
}>;
type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async findAll(query: PaymentRequestQueryDto, user: AuthUser) {
    if (query.includeDeleted && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException(
        'Просмотр удалённых заявок доступен только администратору',
      );
    }
    const rows = await this.prisma.paymentRequest.findMany({
      where: {
        deletedAt: query.includeDeleted ? undefined : null,
        transportationId: query.transportationId,
        status: query.status,
        transportation: {
          is: {
            AND: [
              transportationVisibilityWhere(user),
              {
                deletedAt: query.includeDeleted ? undefined : null,
                deal: {
                  deletedAt: query.includeDeleted ? undefined : null,
                },
              },
            ],
          },
        },
      },
      include: paymentRequestInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toResponse(row));
  }

  async createContext(
    query: PaymentRequestContextQueryDto,
    user: AuthUser,
  ) {
    const transportation = await this.getVisibleTransportation(
      query.transportationId,
      user,
    );
    const selectedLeg = query.legId
      ? transportation.legs.find((leg) => leg.id === query.legId)
      : undefined;
    if (query.legId && !selectedLeg) {
      throw new BadRequestException(
        'Указанный участок не относится к этой перевозке',
      );
    }
    const [contractors, currencies] = await Promise.all([
      this.prisma.contractor.findMany({
        where: { deletedAt: null, NOT: { types: { has: 'GROUP_ENTITY' } } },
        select: { id: true, name: true, types: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.currency.findMany({
        where: { isActive: true },
        select: { code: true, name: true, isBase: true },
        orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
      }),
    ]);
    const dueDate = this.today();
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);

    return {
      transportation: {
        id: transportation.id,
        number: transportation.number,
        originPoint: transportation.originPoint,
        destinationPoint: transportation.destinationPoint,
      },
      legs: transportation.legs,
      contractors,
      currencies,
      suggested: {
        legId: selectedLeg?.id ?? null,
        payeeContractorId: selectedLeg?.subcontractorId ?? null,
        amount: selectedLeg?.subcontractorRate ?? null,
        currencyCode: selectedLeg?.subcontractorRateCurrency ?? null,
        dueDate: this.dateString(dueDate),
        purpose: selectedLeg
          ? `Оплата услуг субподрядчика по участку ${selectedLeg.orderIndex}: ${selectedLeg.fromPoint} — ${selectedLeg.toPoint}`
          : '',
      },
    };
  }

  async create(dto: CreatePaymentRequestDto, user: AuthUser) {
    const transportation = await this.getVisibleTransportation(
      dto.transportationId,
      user,
    );
    if (
      dto.legId &&
      !transportation.legs.some((leg) => leg.id === dto.legId)
    ) {
      throw new BadRequestException(
        'Указанный участок не относится к этой перевозке',
      );
    }
    await this.ensureReferences(dto.payeeContractorId, dto.currencyCode);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentRequest.create({
        data: {
          transportationId: transportation.id,
          legId: dto.legId ?? null,
          payeeContractorId: dto.payeeContractorId,
          amount: new Prisma.Decimal(dto.amount),
          currencyCode: dto.currencyCode.toUpperCase(),
          dueDate: this.parseDate(dto.dueDate),
          purpose: dto.purpose.trim(),
          createdByUserId: user.id,
        },
        include: paymentRequestInclude,
      });
      await this.writeAudit(
        tx,
        user.id,
        row.id,
        AuditAction.CREATE,
        this.creationChanges(row),
      );
      return row;
    });
    return this.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdatePaymentRequestDto,
    user: AuthUser,
  ) {
    const current = await this.getActiveVisible(id, user);
    if (current.status === PaymentRequestStatus.PAID) {
      throw new BadRequestException(
        'Оплаченную заявку нельзя редактировать',
      );
    }
    if (
      dto.amount === undefined &&
      dto.dueDate === undefined &&
      dto.purpose === undefined
    ) {
      throw new BadRequestException('Не указаны изменения заявки');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentRequest.updateMany({
        where: {
          id,
          deletedAt: null,
          status: { not: PaymentRequestStatus.PAID },
        },
        data: {
          amount:
            dto.amount === undefined
              ? undefined
              : new Prisma.Decimal(dto.amount),
          dueDate:
            dto.dueDate === undefined
              ? undefined
              : this.parseDate(dto.dueDate),
          purpose: dto.purpose?.trim(),
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Заявка уже оплачена или изменена другим пользователем',
        );
      }
      const row = await tx.paymentRequest.findUniqueOrThrow({
        where: { id },
        include: paymentRequestInclude,
      });
      await this.writeAudit(
        tx,
        user.id,
        id,
        AuditAction.UPDATE,
        this.diff(current, row),
      );
      return row;
    });
    return this.toResponse(updated);
  }

  async approve(id: string, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    if (current.status !== PaymentRequestStatus.REQUESTED) {
      throw new BadRequestException(
        'Согласовать можно только заявку в статусе «Заявлен»',
      );
    }
    return this.transition(
      current,
      user,
      PaymentRequestStatus.APPROVED,
      {
        status: PaymentRequestStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    );
  }

  async pay(id: string, dto: PayPaymentRequestDto, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    if (current.status !== PaymentRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Оплатить можно только согласованную заявку',
      );
    }
    return this.transition(
      current,
      user,
      PaymentRequestStatus.PAID,
      {
        status: PaymentRequestStatus.PAID,
        paidByUserId: user.id,
        paidAt: new Date(),
        actualExchangeRate:
          dto.actualExchangeRate === undefined
            ? undefined
            : new Prisma.Decimal(dto.actualExchangeRate),
      },
    );
  }

  /**
   * Перевыставление расхода на другое юрлицо (раздел 4.4.6 ТЗ): расход
   * оплачен юрлицом, отличным от юрлица сделки — создаётся внутренний
   * счёт от фактически оплатившего юрлица к юрлицу сделки.
   */
  async reissue(id: string, dto: ReissuePaymentRequestDto, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    if (current.status !== PaymentRequestStatus.PAID) {
      throw new BadRequestException(
        'Перевыставить можно только оплаченную заявку',
      );
    }
    if (current.reimbursementInvoiceId) {
      throw new BadRequestException('Эта заявка уже перевыставлена');
    }
    const dealLegalEntityId = current.transportation.deal.legalEntityId;
    if (dto.payerLegalEntityId === dealLegalEntityId) {
      throw new BadRequestException(
        'Совпадает с юрлицом сделки — перевыставление не требуется',
      );
    }
    const [payerLegalEntity, dealLegalEntity] = await Promise.all([
      this.prisma.legalEntity.findFirst({
        where: { id: dto.payerLegalEntityId, isActive: true },
        select: { id: true, numberingPrefix: true, contractorId: true },
      }),
      this.prisma.legalEntity.findUnique({
        where: { id: dealLegalEntityId },
        select: { contractorId: true },
      }),
    ]);
    if (!payerLegalEntity) {
      throw new BadRequestException('Активное юрлицо-плательщик не найдено');
    }
    if (!payerLegalEntity.contractorId || !dealLegalEntity?.contractorId) {
      throw new BadRequestException(
        'У одного из юрлиц нет связанного контрагента — обратитесь к администратору',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoice = await this.invoicesService.createIntragroupInvoice(tx, {
        transportationId: current.transportationId,
        payerLegalEntityId: payerLegalEntity.id,
        payerLegalEntityNumberingPrefix: payerLegalEntity.numberingPrefix,
        clientContractorId: dealLegalEntity.contractorId!,
        currencyCode: current.currencyCode,
        amount: current.amount,
        description: `Возмещение расхода по перевозке ${current.transportation.number}: ${current.purpose}`,
        actorUserId: user.id,
      });
      const result = await tx.paymentRequest.updateMany({
        where: { id, deletedAt: null, reimbursementInvoiceId: null },
        data: {
          payerLegalEntityId: payerLegalEntity.id,
          reimbursementInvoiceId: invoice.id,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Заявка уже изменена другим пользователем',
        );
      }
      const row = await tx.paymentRequest.findUniqueOrThrow({
        where: { id },
        include: paymentRequestInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        payerLegalEntityId: { old: null, new: payerLegalEntity.id },
        reimbursementInvoiceId: { old: null, new: invoice.id },
      });
      return row;
    });
    return this.toResponse(updated);
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    const removed = await this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentRequest.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: paymentRequestInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.DELETE, {
        deletedAt: {
          old: null,
          new: row.deletedAt?.toISOString() ?? null,
        },
      });
      return row;
    });
    return this.toResponse(removed);
  }

  private async transition(
    current: PaymentRequestWithRelations,
    user: AuthUser,
    status: PaymentRequestStatus,
    data: Prisma.PaymentRequestUncheckedUpdateInput,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentRequest.updateMany({
        where: {
          id: current.id,
          status: current.status,
          deletedAt: null,
        },
        data,
      });
      if (result.count !== 1) {
        throw new ConflictException(
          'Статус заявки уже изменён другим пользователем',
        );
      }
      const row = await tx.paymentRequest.findUniqueOrThrow({
        where: { id: current.id },
        include: paymentRequestInclude,
      });
      await this.writeAudit(
        tx,
        user.id,
        row.id,
        AuditAction.UPDATE,
        this.diff(current, row),
      );
      return row;
    });
    if (updated.status !== status) {
      throw new BadRequestException('Не удалось изменить статус заявки');
    }
    return this.toResponse(updated);
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
          transportationVisibilityWhere(user),
        ],
      },
      select: {
        id: true,
        number: true,
        originPoint: true,
        destinationPoint: true,
        legs: {
          select: {
            id: true,
            orderIndex: true,
            fromPoint: true,
            toPoint: true,
            subcontractorId: true,
            subcontractorRate: true,
            subcontractorRateCurrency: true,
            subcontractor: {
              select: { id: true, name: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!transportation) {
      throw new ForbiddenException('Нет доступа к этой перевозке');
    }
    return transportation;
  }

  private async getActiveVisible(
    id: string,
    user: AuthUser,
  ): Promise<PaymentRequestWithRelations> {
    const exists = await this.prisma.paymentRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Заявка на оплату не найдена');

    const row = await this.prisma.paymentRequest.findFirst({
      where: {
        id,
        deletedAt: null,
        transportation: {
          is: {
            AND: [
              transportationVisibilityWhere(user),
              { deletedAt: null, deal: { deletedAt: null } },
            ],
          },
        },
      },
      include: paymentRequestInclude,
    });
    if (!row) throw new ForbiddenException('Нет доступа к этой заявке');
    return row;
  }

  private async ensureReferences(
    payeeContractorId: string,
    currencyCode: string,
  ) {
    const normalizedCurrency = currencyCode.toUpperCase();
    const [payee, currency] = await Promise.all([
      this.prisma.contractor.findFirst({
        where: { id: payeeContractorId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.currency.findFirst({
        where: { code: normalizedCurrency, isActive: true },
        select: { code: true },
      }),
    ]);
    if (!payee) {
      throw new BadRequestException('Активный получатель не найден');
    }
    if (!currency) {
      throw new BadRequestException('Активная валюта не найдена');
    }
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Дата указана неверно');
    }
    return date;
  }

  private today(): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return new Date(
      Date.UTC(
        Number(value.year),
        Number(value.month) - 1,
        Number(value.day),
      ),
    );
  }

  private dateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private snapshot(
    row: PaymentRequestWithRelations,
  ): Record<string, unknown> {
    return {
      transportationId: row.transportationId,
      legId: row.legId,
      payeeContractorId: row.payeeContractorId,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      dueDate: this.dateString(row.dueDate),
      purpose: row.purpose,
      status: row.status,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      paidByUserId: row.paidByUserId,
      paidAt: row.paidAt?.toISOString() ?? null,
      actualExchangeRate: row.actualExchangeRate?.toString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdByUserId: row.createdByUserId,
    };
  }

  private creationChanges(row: PaymentRequestWithRelations): Changes {
    return Object.fromEntries(
      Object.entries(this.snapshot(row)).map(([key, value]) => [
        key,
        { old: null, new: value },
      ]),
    );
  }

  private diff(
    oldRow: PaymentRequestWithRelations,
    newRow: PaymentRequestWithRelations,
  ): Changes {
    const oldSnapshot = this.snapshot(oldRow);
    const newSnapshot = this.snapshot(newRow);
    const changes: Changes = {};
    for (const key of Object.keys(oldSnapshot)) {
      if (
        JSON.stringify(oldSnapshot[key]) !==
        JSON.stringify(newSnapshot[key])
      ) {
        changes[key] = {
          old: oldSnapshot[key],
          new: newSnapshot[key],
        };
      }
    }
    return changes;
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    entityId: string,
    action: AuditAction,
    changes: Changes,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: 'PaymentRequest',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private toResponse(row: PaymentRequestWithRelations) {
    return {
      ...row,
      amount: row.amount.toString(),
      dueDate: this.dateString(row.dueDate),
      actualExchangeRate: row.actualExchangeRate?.toString() ?? null,
    };
  }
}
