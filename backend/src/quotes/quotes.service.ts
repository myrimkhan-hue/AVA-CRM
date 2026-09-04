import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DealRejectReason,
  DealStage,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanAssignTransportationResponsible } from '../transportations/transportation-policy';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { LoseQuoteDto } from './dto/lose-quote.dto';
import {
  CreateQuoteOptionDto,
  UpdateQuoteOptionDto,
} from './dto/quote-option.dto';
import { QuoteQueryDto } from './dto/quote-query.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import {
  assertCanEditQuoteClientRate,
  canSeeQuoteClientRate,
  presentQuote,
  quoteVisibilityWhere,
} from './quote-policy';

const QUOTE_STAGES: DealStage[] = [
  DealStage.NEW,
  DealStage.RATE_CALCULATION,
  DealStage.RATE_SENT,
  DealStage.REJECTED,
];
const include = {
  deal: {
    include: {
      client: true,
      legalEntity: true,
      responsible: { select: { id: true, fullName: true } },
      department: true,
    },
  },
  logist: { select: { id: true, fullName: true } },
  quoteOptions: {
    where: { deletedAt: null },
    include: { carrier: true },
    orderBy: { sequence: 'asc' as const },
  },
};
type QuoteRow = Prisma.TransportationGetPayload<{ include: typeof include }>;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async create(dto: CreateQuoteDto, user: AuthUser) {
    if (dto.clientId && dto.clientName)
      throw new BadRequestException(
        'Укажите либо существующего клиента, либо нового',
      );
    const responsibleId = dto.responsibleId ?? user.id;
    await this.ensureAssignments(
      dto.legalEntityId,
      responsibleId,
      dto.logistId,
      dto.departmentId,
      user,
    );
    await this.ensureRate(dto.clientTargetRateCurrency, dto.quoteRateDate);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const clientId = dto.clientId
            ? await this.existingClient(tx, dto.clientId)
            : (
                await tx.contractor.create({
                  data: {
                    name: dto.clientName!.trim(),
                    types: ['CLIENT'],
                    isProspect: true,
                  },
                })
              ).id;
          const responsible = await tx.user.findUniqueOrThrow({
            where: { id: responsibleId },
            select: { departmentId: true },
          });
          const departmentId = dto.departmentId ?? responsible.departmentId;
          const legalEntity = await tx.legalEntity.findUniqueOrThrow({
            where: { id: dto.legalEntityId },
          });
          const year = new Date().getFullYear();
          const [dealSequence, quoteSequence] = await Promise.all([
            tx.dealNumberSequence.upsert({
              where: {
                legalEntityId_year: { legalEntityId: dto.legalEntityId, year },
              },
              create: { legalEntityId: dto.legalEntityId, year, lastNumber: 1 },
              update: { lastNumber: { increment: 1 } },
            }),
            tx.quoteNumberSequence.upsert({
              where: {
                legalEntityId_year: { legalEntityId: dto.legalEntityId, year },
              },
              create: { legalEntityId: dto.legalEntityId, year, lastNumber: 1 },
              update: { lastNumber: { increment: 1 } },
            }),
          ]);
          const deal = await tx.deal.create({
            data: {
              number: `${legalEntity.numberingPrefix}-${year}-${String(dealSequence.lastNumber).padStart(4, '0')}`,
              legalEntityId: dto.legalEntityId,
              clientId,
              responsibleId,
              departmentId,
              stage: DealStage.RATE_CALCULATION,
              clientTargetRate: dto.clientTargetRate,
              clientTargetRateCurrency: dto.clientTargetRateCurrency,
              quoteRateDate: this.date(dto.quoteRateDate),
            },
          });
          const transportation = await tx.transportation.create({
            data: {
              number: `Р-${year}-${String(quoteSequence.lastNumber).padStart(4, '0')}`,
              isQuoteDraft: true,
              dealId: deal.id,
              sequenceInDeal: 1,
              logistId: dto.logistId,
              originPoint: dto.originPoint.trim(),
              destinationPoint: dto.destinationPoint.trim(),
              transportMode: dto.transportMode,
              cargoName: this.text(dto.cargoName),
              weightKg: dto.weightKg,
              volumeM3: dto.volumeM3,
              placesCount: dto.placesCount,
              placesUnit: this.text(dto.placesUnit),
              isDangerous: dto.isDangerous,
              deliveryTerms: dto.deliveryTerms,
              cargoReadyDate: this.date(dto.cargoReadyDate),
            },
            include,
          });
          await this.audit(tx, user.id, deal.id, AuditAction.CREATE, {
            quoteNumber: { old: null, new: transportation.number },
          });
          return transportation;
        });
        return this.present(row, user);
      } catch (error) {
        if (this.uniqueConflict(error) && attempt < 3) continue;
        if (this.uniqueConflict(error))
          throw new BadRequestException(
            'Не удалось сформировать уникальный номер просчёта',
          );
        throw error;
      }
    }
  }

  async findAll(query: QuoteQueryDto, user: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TransportationWhereInput = {
      AND: [
        quoteVisibilityWhere(user),
        {
          isQuoteDraft: true,
          deletedAt: null,
          deal: { deletedAt: null, stage: query.stage ?? { in: QUOTE_STAGES } },
        },
        query.responsibleId
          ? { deal: { responsibleId: query.responsibleId } }
          : {},
        query.logistId ? { logistId: query.logistId } : {},
        query.departmentId
          ? { deal: { departmentId: query.departmentId } }
          : {},
        query.from || query.to
          ? {
              createdAt: {
                gte: query.from ? new Date(query.from) : undefined,
                lte: query.to ? this.endOfDay(new Date(query.to)) : undefined,
              },
            }
          : {},
        query.search
          ? {
              OR: [
                { number: { contains: query.search, mode: 'insensitive' } },
                {
                  originPoint: { contains: query.search, mode: 'insensitive' },
                },
                {
                  destinationPoint: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  deal: {
                    client: {
                      name: { contains: query.search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.transportation.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transportation.count({ where }),
    ]);
    return {
      items: await Promise.all(items.map((row) => this.present(row, user))),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, user: AuthUser) {
    return this.present(await this.visible(id, user), user);
  }

  async update(id: string, dto: UpdateQuoteDto, user: AuthUser) {
    const current = await this.active(id, user);
    await this.ensureRate(dto.clientTargetRateCurrency, dto.quoteRateDate);
    const transportationData = this.defined({
      originPoint: dto.originPoint?.trim(),
      destinationPoint: dto.destinationPoint?.trim(),
      cargoName: this.text(dto.cargoName),
      weightKg: dto.weightKg,
      volumeM3: dto.volumeM3,
      placesCount: dto.placesCount,
      placesUnit: this.text(dto.placesUnit),
      isDangerous: dto.isDangerous,
      deliveryTerms: dto.deliveryTerms,
      cargoReadyDate: this.date(dto.cargoReadyDate),
      transportMode: dto.transportMode,
    });
    const dealData = this.defined({
      clientTargetRate: dto.clientTargetRate,
      clientTargetRateCurrency: dto.clientTargetRateCurrency,
      quoteRateDate: this.date(dto.quoteRateDate),
    });
    const row = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(dealData).length)
        await tx.deal.update({ where: { id: current.dealId }, data: dealData });
      const updated = await tx.transportation.update({
        where: { id },
        data: transportationData,
        include,
      });
      await this.audit(tx, user.id, current.dealId, AuditAction.UPDATE, {
        quote: { old: this.snapshot(current), new: this.snapshot(updated) },
      });
      return updated;
    });
    return this.present(row, user);
  }

  async addOption(id: string, dto: CreateQuoteOptionDto, user: AuthUser) {
    const quote = await this.active(id, user);
    assertCanEditQuoteClientRate(user, dto);
    await this.ensureCarrier(dto.carrierId);
    await Promise.all([
      this.ensureRate(
        dto.costRateCurrency,
        quote.deal.quoteRateDate?.toISOString(),
      ),
      this.ensureRate(
        dto.clientRateCurrency,
        quote.deal.quoteRateDate?.toISOString(),
      ),
    ]);
    const aggregate = await this.prisma.quoteOption.aggregate({
      where: { transportationId: id },
      _max: { sequence: true },
    });
    const option = await this.prisma.quoteOption.create({
      data: {
        transportationId: id,
        sequence: (aggregate._max.sequence ?? 0) + 1,
        ...this.optionData(dto),
      },
      include: { carrier: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: 'QuoteOption',
        entityId: option.id,
        action: AuditAction.CREATE,
        changes: {},
      },
    });
    return this.presentOption(option, user, quote);
  }

  async updateOption(
    id: string,
    optionId: string,
    dto: UpdateQuoteOptionDto,
    user: AuthUser,
  ) {
    const quote = await this.active(id, user);
    assertCanEditQuoteClientRate(user, dto);
    await this.ensureCarrier(dto.carrierId);
    await Promise.all([
      this.ensureRate(
        dto.costRateCurrency,
        quote.deal.quoteRateDate?.toISOString(),
      ),
      this.ensureRate(
        dto.clientRateCurrency,
        quote.deal.quoteRateDate?.toISOString(),
      ),
    ]);
    const current = await this.prisma.quoteOption.findFirst({
      where: { id: optionId, transportationId: id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Вариант расчёта не найден');
    const option = await this.prisma.quoteOption.update({
      where: { id: optionId },
      data: this.optionData(dto),
      include: { carrier: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: 'QuoteOption',
        entityId: option.id,
        action: AuditAction.UPDATE,
        changes: {
          option: { old: this.snapshot(current), new: this.snapshot(option) },
        },
      },
    });
    return this.presentOption(option, user, quote);
  }

  async removeOption(id: string, optionId: string, user: AuthUser) {
    const quote = await this.active(id, user);
    const current = await this.prisma.quoteOption.findFirst({
      where: { id: optionId, transportationId: id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Вариант расчёта не найден');
    const deleted = await this.prisma.quoteOption.update({
      where: { id: optionId },
      data: { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: 'QuoteOption',
        entityId: optionId,
        action: AuditAction.DELETE,
        changes: {
          deletedAt: { old: null, new: deleted.deletedAt?.toISOString() },
        },
      },
    });
    return this.presentOption(deleted, user, quote);
  }

  async sent(id: string, user: AuthUser) {
    return this.stage(id, DealStage.RATE_SENT, user);
  }
  async lose(id: string, dto: LoseQuoteDto, user: AuthUser) {
    if (
      dto.rejectReason === DealRejectReason.OTHER &&
      !dto.rejectComment?.trim()
    )
      throw new BadRequestException('Для причины «Другое» укажите комментарий');
    return this.stage(id, DealStage.REJECTED, user, dto);
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.active(id, user);
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: current.dealId },
        data: { deletedAt: now },
      });
      const deleted = await tx.transportation.update({
        where: { id },
        data: { deletedAt: now },
        include,
      });
      await this.audit(tx, user.id, current.dealId, AuditAction.DELETE, {
        deletedAt: { old: null, new: now.toISOString() },
      });
      return deleted;
    });
    return this.present(row, user);
  }

  private async stage(
    id: string,
    stage: DealStage,
    user: AuthUser,
    reject?: LoseQuoteDto,
  ) {
    const current = await this.active(id, user);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: current.dealId },
        data: {
          stage,
          rejectReason: reject?.rejectReason ?? null,
          rejectComment: reject?.rejectComment?.trim() || null,
        },
      });
      await this.audit(tx, user.id, current.dealId, AuditAction.UPDATE, {
        stage: { old: current.deal.stage, new: stage },
      });
      return tx.transportation.findUniqueOrThrow({ where: { id }, include });
    });
    return this.present(row, user);
  }

  private async visible(id: string, user: AuthUser): Promise<QuoteRow> {
    const exists = await this.prisma.transportation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Просчёт не найден');
    const row = await this.prisma.transportation.findFirst({
      where: {
        AND: [
          { id },
          quoteVisibilityWhere(user),
          {
            isQuoteDraft: true,
            deletedAt: null,
            deal: { deletedAt: null, stage: { in: QUOTE_STAGES } },
          },
        ],
      },
      include,
    });
    if (!row) throw new ForbiddenException('Нет доступа к этому просчёту');
    return row;
  }
  private async active(id: string, user: AuthUser) {
    return this.visible(id, user);
  }

  private async present(row: QuoteRow, user: AuthUser) {
    const result = presentQuote(row, user);
    const date = row.deal.quoteRateDate;
    if (!date) return result;
    const targetRate = await this.toKzt(
      row.deal.clientTargetRate,
      row.deal.clientTargetRateCurrency,
      date,
    );
    const options = await Promise.all(
      result.quoteOptions.map(async (option) => ({
        ...option,
        costRateKzt: await this.toKzt(
          option.costRate as Prisma.Decimal | null,
          option.costRateCurrency as string | null,
          date,
        ),
        ...(canSeeQuoteClientRate(user, row)
          ? {
              clientRateKzt: await this.toKzt(
                option.clientRate as Prisma.Decimal | null,
                option.clientRateCurrency as string | null,
                date,
              ),
            }
          : {}),
      })),
    );
    return {
      ...result,
      deal: { ...result.deal, clientTargetRateKzt: targetRate },
      quoteOptions: options,
    };
  }
  private presentOption<T extends Record<string, unknown>>(
    option: T,
    user: AuthUser,
    quote: QuoteRow,
  ) {
    if (canSeeQuoteClientRate(user, quote)) return option;
    const {
      clientRate: _rate,
      clientRateCurrency: _currency,
      ...visible
    } = option;
    return visible;
  }
  private async ensureAssignments(
    legalEntityId: string,
    responsibleId: string,
    logistId: string,
    departmentId: string | undefined,
    user: AuthUser,
  ) {
    const [legal, responsible, logist, department] = await Promise.all([
      this.prisma.legalEntity.findFirst({
        where: { id: legalEntityId, isActive: true },
      }),
      this.prisma.user.findFirst({
        where: { id: responsibleId, isActive: true },
        select: { id: true, departmentId: true },
      }),
      this.prisma.user.findFirst({
        where: {
          id: logistId,
          isActive: true,
          roles: { some: { role: { code: 'LOGIST' } } },
        },
      }),
      departmentId
        ? this.prisma.department.findUnique({ where: { id: departmentId } })
        : Promise.resolve(true),
    ]);
    if (!legal) throw new BadRequestException('Активное юрлицо не найдено');
    if (!responsible)
      throw new BadRequestException('Активный менеджер не найден');
    assertCanAssignTransportationResponsible(user, responsible);
    if (!logist) throw new BadRequestException('Активный логист не найден');
    if (!department) throw new BadRequestException('Отдел не найден');
  }
  private async existingClient(tx: Prisma.TransactionClient, id: string) {
    const row = await tx.contractor.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new BadRequestException('Активный клиент не найден');
    return row.id;
  }
  private async ensureCarrier(id?: string) {
    if (!id) return;
    const row = await this.prisma.contractor.findFirst({
      where: { id, deletedAt: null, types: { has: 'CARRIER' } },
    });
    if (!row) throw new BadRequestException('Активный перевозчик не найден');
  }
  private async ensureRate(currency?: string, date?: string) {
    if (!currency) return;
    if (!date)
      throw new BadRequestException(
        'Для валютной ставки укажите дату фиксации курса',
      );
    if (!(await this.exchangeRates.getRate(currency, this.date(date)!)))
      throw new BadRequestException(
        `Нет курса валюты ${currency} на дату просчёта`,
      );
  }
  private async toKzt(
    value: Prisma.Decimal | null,
    currency: string | null,
    date: Date,
  ) {
    if (!value || !currency) return null;
    const rate = await this.exchangeRates.getRate(currency, date);
    return rate ? value.mul(rate.rate).toDecimalPlaces(2).toString() : null;
  }
  private optionData(dto: CreateQuoteOptionDto) {
    return this.defined({
      vehicleType: this.text(dto.vehicleType),
      carrierId: dto.carrierId,
      costRate: dto.costRate,
      costRateCurrency: dto.costRateCurrency,
      clientRate: dto.clientRate,
      clientRateCurrency: dto.clientRateCurrency,
      transitDays: dto.transitDays,
      notes: this.text(dto.notes),
    });
  }
  private date(value?: string | null) {
    return value ? new Date(value) : value === null ? null : undefined;
  }
  private text(value?: string | null) {
    return value === undefined ? undefined : value?.trim() || null;
  }
  private endOfDay(value: Date) {
    return new Date(value.getTime() + 86_399_999);
  }
  private defined<T extends object>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
  }
  private uniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
  private snapshot(value: object) {
    return JSON.parse(JSON.stringify(value));
  }
  private audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    entityId: string,
    action: AuditAction,
    changes: object,
  ) {
    return tx.auditLog.create({
      data: {
        actorUserId,
        entityType: 'Quote',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }
}
