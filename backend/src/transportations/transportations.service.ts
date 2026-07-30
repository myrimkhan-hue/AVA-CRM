import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  LegTransportMode,
  NotificationType,
  Prisma,
  TransportationStatus,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { MarginService } from '../deals/margin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { renderTemplate } from '../whatsapp/whatsapp-rules';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CreateTransportationDto } from './dto/create-transportation.dto';
import {
  CreateTransportationLegDto,
  UpdateTransportationLegDto,
} from './dto/transportation-leg.dto';
import { TransportationQueryDto } from './dto/transportation-query.dto';
import { UpdateTransportationStatusDto } from './dto/update-transportation-status.dto';
import { UpdateTransportationDto } from './dto/update-transportation.dto';
import {
  assertCanAssignTransportationResponsible,
  canSeeTransportationClientRate,
  resolveStatusBusinessEventDate,
  resolveStatusTransition,
  transportationVisibilityWhere,
} from './transportation-policy';

const transportationInclude = {
  deal: {
    select: {
      id: true,
      number: true,
      departmentId: true,
      responsibleId: true,
      client: { select: { id: true, name: true } },
      legalEntity: { select: { id: true, name: true } },
    },
  },
  logist: { select: { id: true, fullName: true } },
  legs: {
    include: { subcontractor: { select: { id: true, name: true } } },
    orderBy: { orderIndex: 'asc' as const },
  },
  invoices: {
    where: { deletedAt: null, isIntragroup: false },
    take: 1,
    select: {
      id: true,
      number: true,
      status: true,
    },
  },
} satisfies Prisma.TransportationInclude;

const eventInclude = {
  setBy: { select: { id: true, fullName: true } },
} satisfies Prisma.TransportationStatusEventInclude;

type TransportationWithRelations = Prisma.TransportationGetPayload<{
  include: typeof transportationInclude;
}>;
type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class TransportationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marginService: MarginService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async findAll(query: TransportationQueryDto, user: AuthUser) {
    if (query.includeDeleted && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException('Просмотр удалённых перевозок доступен только администратору');
    }
    const search = query.search?.trim();
    const rows = await this.prisma.transportation.findMany({
      where: {
        AND: [
          this.visibilityWhere(user),
          {
            deletedAt: query.includeDeleted ? undefined : null,
            // Перевозка удалённой сделки не считается активной: так же её
            // исключают все отчёты (дебиторка, кредиторка, дашборд, мотивация).
            deal: query.includeDeleted ? undefined : { deletedAt: null },
            status: query.status,
            dealId: query.dealId,
            logistId: query.logistId,
            OR: search
              ? [
                  { number: { contains: search, mode: 'insensitive' } },
                  { cargoName: { contains: search, mode: 'insensitive' } },
                  { originPoint: { contains: search, mode: 'insensitive' } },
                  { destinationPoint: { contains: search, mode: 'insensitive' } },
                  { deal: { number: { contains: search, mode: 'insensitive' } } },
                  { deal: { client: { name: { contains: search, mode: 'insensitive' } } } },
                  {
                    legs: {
                      some: {
                        subcontractor: { name: { contains: search, mode: 'insensitive' } },
                      },
                    },
                  },
                ]
              : undefined,
          },
        ],
      },
      include: transportationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.present(row, user));
  }

  async findOne(id: string, user: AuthUser) {
    return this.present(await this.getVisible(id, user, user.roles.includes('ADMIN')), user);
  }

  async getMargin(id: string, user: AuthUser) {
    if (!canSeeTransportationClientRate(user)) {
      throw new ForbiddenException('Нет доступа к финансовым показателям перевозки');
    }
    await this.getActiveVisible(id, user);
    return this.marginService.calculateForTransportations([id]);
  }

  async create(dto: CreateTransportationDto, user: AuthUser) {
    this.ensureClientRateAccess(dto, user);
    const deal = await this.prisma.deal.findFirst({
      where: { id: dto.dealId, deletedAt: null, AND: [this.dealVisibilityWhere(user)] },
      select: { id: true, number: true },
    });
    if (!deal) throw new BadRequestException('Активная доступная сделка не найдена');
    const logistId = dto.logistId ?? user.id;
    await this.ensureResponsibleAssignment(logistId, user);
    if (dto.initialLeg?.subcontractorId) await this.ensureCarrier(dto.initialLeg.subcontractorId);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const aggregate = await tx.transportation.aggregate({
            where: { dealId: deal.id },
            _max: { sequenceInDeal: true },
          });
          const sequenceInDeal = (aggregate._max.sequenceInDeal ?? 0) + 1;
          const number = `${deal.number}/${sequenceInDeal}`;
          const base = await tx.transportation.create({
            data: {
              ...this.transportationCreateData(dto),
              dealId: deal.id,
              sequenceInDeal,
              logistId,
              number,
              isMultiLeg: false,
            },
          });
          await tx.transportationLeg.create({
            data: {
              ...this.legCreateData(dto.initialLeg ?? {}, dto.originPoint, dto.destinationPoint, this.initialLegMode(dto)),
              transportationId: base.id,
              orderIndex: 1,
            },
          });
          await tx.transportationStatusEvent.create({
            data: { transportationId: base.id, toStatus: TransportationStatus.REQUEST_ACCEPTED, eventDate: null, setById: user.id },
          });
          const row = await tx.transportation.findUniqueOrThrow({
            where: { id: base.id },
            include: transportationInclude,
          });
          await this.writeAudit(tx, user.id, row.id, AuditAction.CREATE, this.creationChanges(row));
          return row;
        });
        if (created.logistId !== user.id) {
          await this.notificationsService.notify(
            created.logistId,
            NotificationType.RESPONSIBLE_ASSIGNED,
            'Вам назначена перевозка',
            `Вы назначены ответственным по перевозке ${created.number}`,
            'Transportation',
            created.id,
          );
        }
        return this.present(created, user);
      } catch (error: unknown) {
        if (this.isUniqueConflict(error) && attempt < 3) {
          continue;
        }
        if (this.isUniqueConflict(error)) {
          throw new BadRequestException('Не удалось сформировать уникальный номер перевозки');
        }
        throw error;
      }
    }
    throw new BadRequestException('Не удалось создать перевозку');
  }

  async update(id: string, dto: UpdateTransportationDto, user: AuthUser) {
    this.ensureClientRateAccess(dto, user);
    const current = await this.getActiveVisible(id, user);
    if (dto.logistId) await this.ensureResponsibleAssignment(dto.logistId, user);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.transportation.update({
        where: { id },
        data: this.transportationUpdateData(dto),
      });
      if (!current.isMultiLeg && current.legs.length === 1) {
        await tx.transportationLeg.update({
          where: { id: current.legs[0].id },
          data: this.removeUndefined({
            fromPoint: dto.originPoint?.trim(),
            toPoint: dto.destinationPoint?.trim(),
            mode: dto.transportMode ? this.legModeFromTransportation(dto.transportMode) : undefined,
          }),
        });
      }
      const row = await tx.transportation.findUniqueOrThrow({ where: { id }, include: transportationInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, this.diff(current, row));
      return row;
    });
    if (dto.logistId && dto.logistId !== current.logistId && dto.logistId !== user.id) {
      await this.notificationsService.notify(
        updated.logistId,
        NotificationType.RESPONSIBLE_ASSIGNED,
        'Вам назначена перевозка',
        `Вы назначены ответственным по перевозке ${updated.number}`,
        'Transportation',
        updated.id,
      );
    }
    return this.present(updated, user);
  }

  async addLeg(id: string, dto: CreateTransportationLegDto, user: AuthUser) {
    await this.getActiveVisible(id, user);
    if (dto.subcontractorId) await this.ensureCarrier(dto.subcontractorId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.transportationLeg.aggregate({
        where: { transportationId: id },
        _max: { orderIndex: true },
      });
      const leg = await tx.transportationLeg.create({
        data: {
          ...this.legCreateData(dto, dto.fromPoint, dto.toPoint, dto.mode),
          transportationId: id,
          orderIndex: (aggregate._max.orderIndex ?? 0) + 1,
        },
      });
      const row = await tx.transportation.update({
        where: { id },
        data: { isMultiLeg: true },
        include: transportationInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        legs: { old: null, new: { action: 'add', legId: leg.id, orderIndex: leg.orderIndex } },
      });
      return row;
    });
    return this.present(updated, user);
  }

  async updateLeg(id: string, legId: string, dto: UpdateTransportationLegDto, user: AuthUser) {
    await this.getActiveVisible(id, user);
    const current = await this.prisma.transportationLeg.findFirst({ where: { id: legId, transportationId: id } });
    if (!current) throw new NotFoundException('Участок перевозки не найден');
    if (dto.subcontractorId) await this.ensureCarrier(dto.subcontractorId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const leg = await tx.transportationLeg.update({ where: { id: legId }, data: this.legData(dto) });
      const row = await tx.transportation.findUniqueOrThrow({ where: { id }, include: transportationInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        legs: { old: this.legSnapshot(current), new: this.legSnapshot(leg) },
      });
      return row;
    });
    return this.present(updated, user);
  }

  async removeLeg(id: string, legId: string, user: AuthUser) {
    const transportation = await this.getActiveVisible(id, user);
    const current = await this.prisma.transportationLeg.findFirst({ where: { id: legId, transportationId: id } });
    if (!current) throw new NotFoundException('Участок перевозки не найден');
    if (transportation.legs.length === 1) {
      throw new BadRequestException('Нельзя удалить единственный участок перевозки');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.transportationLeg.delete({ where: { id: legId } });
      const remaining = await tx.transportationLeg.findMany({
        where: { transportationId: id }, orderBy: { orderIndex: 'asc' }, select: { id: true },
      });
      for (let index = 0; index < remaining.length; index += 1) {
        await tx.transportationLeg.update({ where: { id: remaining[index].id }, data: { orderIndex: index + 1 } });
      }
      const row = await tx.transportation.update({
        where: { id }, data: { isMultiLeg: true }, include: transportationInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        legs: { old: this.legSnapshot(current), new: { action: 'removed' } },
      });
      return row;
    });
    return this.present(updated, user);
  }

  async split(id: string, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    if (current.isMultiLeg) throw new BadRequestException('Перевозка уже разделена на участки');
    if (current.legs.length !== 1) throw new BadRequestException('У перевозки должен быть один исходный участок');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transportation.update({ where: { id }, data: { isMultiLeg: true }, include: transportationInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        isMultiLeg: { old: false, new: true },
      });
      return row;
    });
    return this.present(updated, user);
  }

  async merge(id: string, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    if (!current.isMultiLeg || !current.legs.length) throw new BadRequestException('Перевозка не разделена на участки');
    if (current.legs.length !== 1) {
      throw new BadRequestException('Объединение возможно, только когда остался один участок');
    }
    const leg = current.legs[0];
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transportation.update({
        where: { id },
        data: {
          isMultiLeg: false,
          originPoint: leg.fromPoint,
          destinationPoint: leg.toPoint,
          transportMode: this.transportationModeFromLeg(leg.mode),
        },
        include: transportationInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        isMultiLeg: { old: true, new: false },
      });
      return row;
    });
    return this.present(updated, user);
  }

  async updateStatus(id: string, dto: UpdateTransportationStatusDto, user: AuthUser) {
    const current = await this.getActiveVisible(id, user);
    const { isRollback } = resolveStatusTransition(current.status, dto.status);
    const businessEventDate = resolveStatusBusinessEventDate(dto.status, dto.eventDate);
    const eventDate = businessEventDate ?? null;
    const statusDates: Prisma.TransportationUncheckedUpdateInput = {};
    if (dto.status === TransportationStatus.CARGO_PICKED) statusDates.pickupEventDate = businessEventDate;
    if (dto.status === TransportationStatus.DELIVERED) {
      statusDates.unloadingEventDate = businessEventDate;
      statusDates.actualDeliveryDate = businessEventDate;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transportation.update({
        where: { id }, data: { status: dto.status, ...statusDates }, include: transportationInclude,
      });
      await tx.transportationStatusEvent.create({
        data: {
          transportationId: id,
          fromStatus: current.status,
          toStatus: dto.status,
          eventDate,
          isRollback,
          setById: user.id,
        },
      });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, {
        ...this.diff(current, row),
      });
      return row;
    });

    const presented = this.present(updated, user);
    if (dto.notifyWhatsapp && dto.whatsappTemplateId) {
      const notifyError = await this.notifyClientWhatsapp(updated, dto.whatsappTemplateId, user.id);
      if (notifyError) return { ...presented, whatsappNotifyError: notifyError };
    }
    return presented;
  }

  /** Возвращает текст ошибки, если отправку не удалось выполнить — статус перевозки при этом уже сохранён. */
  private async notifyClientWhatsapp(
    transportation: TransportationWithRelations,
    templateId: string,
    userId: string,
  ): Promise<string | null> {
    try {
      const template = await this.prisma.whatsAppTemplate.findUnique({ where: { id: templateId } });
      if (!template) return 'Шаблон сообщения не найден';
      const text = renderTemplate(template.body, { number: transportation.number });
      await this.whatsappService.sendToContractor(transportation.deal.client.id, text, userId, templateId);
      return null;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : 'Не удалось отправить сообщение в WhatsApp';
    }
  }

  async history(id: string, user: AuthUser) {
    await this.getVisible(id, user, user.roles.includes('ADMIN'));
    return this.prisma.transportationStatusEvent.findMany({
      where: { transportationId: id }, include: eventInclude, orderBy: { setAt: 'asc' },
    });
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.getVisible(id, user, true);
    if (current.deletedAt) throw new BadRequestException('Перевозка уже удалена');
    const deleted = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transportation.update({ where: { id }, data: { deletedAt: new Date() }, include: transportationInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.DELETE, {
        deletedAt: { old: null, new: row.deletedAt?.toISOString() ?? null },
      });
      return row;
    });
    return this.present(deleted, user);
  }

  async restore(id: string, user: AuthUser) {
    const current = await this.getVisible(id, user, true);
    if (!current.deletedAt) throw new BadRequestException('Перевозка не удалена');
    const restored = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transportation.update({ where: { id }, data: { deletedAt: null }, include: transportationInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.RESTORE, {
        deletedAt: { old: current.deletedAt?.toISOString() ?? null, new: null },
      });
      return row;
    });
    return this.present(restored, user);
  }

  private visibilityWhere(user: AuthUser): Prisma.TransportationWhereInput {
    return transportationVisibilityWhere(user);
  }

  private dealVisibilityWhere(user: AuthUser): Prisma.DealWhereInput {
    if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER', 'LOGIST'].includes(role))) return {};
    const conditions: Prisma.DealWhereInput[] = [];
    if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) conditions.push({ departmentId: user.departmentId });
    if (user.roles.includes('DEPARTMENT_HEAD') || user.roles.includes('MANAGER')) conditions.push({ responsibleId: user.id });
    return conditions.length ? { OR: conditions } : { id: { in: [] } };
  }

  private async getVisible(id: string, user: AuthUser, includeDeleted = false): Promise<TransportationWithRelations> {
    const exists = await this.prisma.transportation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Перевозка не найдена');
    const row = await this.prisma.transportation.findFirst({
      where: {
        AND: [
          { id },
          this.visibilityWhere(user),
          {
            deletedAt: includeDeleted ? undefined : null,
            deal: includeDeleted ? undefined : { deletedAt: null },
          },
        ],
      },
      include: transportationInclude,
    });
    if (!row) throw new ForbiddenException('Нет доступа к этой перевозке');
    return row;
  }

  private async getActiveVisible(id: string, user: AuthUser) {
    const row = await this.getVisible(id, user, true);
    if (row.deletedAt) throw new BadRequestException('Нельзя изменить удалённую перевозку');
    return row;
  }

  private canSeeClientRate(user: AuthUser, row?: TransportationWithRelations): boolean {
    if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role))) return true;
    if (!row) return canSeeTransportationClientRate(user);
    if (user.roles.includes('DEPARTMENT_HEAD') && row.deal.departmentId === user.departmentId) return true;
    if (user.roles.includes('MANAGER') && row.deal.responsibleId === user.id) return true;
    return false;
  }

  private present(row: TransportationWithRelations, user: AuthUser) {
    if (this.canSeeClientRate(user, row)) {
      const invoice = row.invoices[0] ?? null;
      const { invoices: _invoices, ...transportation } = row;
      return {
        ...transportation,
        invoice,
      };
    }
    const {
      clientRate: _clientRate,
      clientRateCurrency: _clientRateCurrency,
      invoices: _invoices,
      ...visible
    } = row;
    return visible;
  }

  private ensureClientRateAccess(
    dto: Pick<CreateTransportationDto, 'clientRate' | 'clientRateCurrency'>,
    user: AuthUser,
  ): void {
    if (!this.canSeeClientRate(user) && (dto.clientRate !== undefined || dto.clientRateCurrency !== undefined)) {
      throw new ForbiddenException('Недостаточно прав для работы со ставкой клиента');
    }
  }

  private async ensureResponsibleAssignment(id: string, actor: AuthUser): Promise<void> {
    const row = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: { id: true, departmentId: true },
    });
    if (!row) throw new BadRequestException('Активный ответственный не найден');
    assertCanAssignTransportationResponsible(actor, row);
  }

  private async ensureCarrier(id: string) {
    const row = await this.prisma.contractor.findFirst({
      where: { id, deletedAt: null, types: { has: 'CARRIER' } }, select: { id: true },
    });
    if (!row) throw new BadRequestException('Активный перевозчик не найден');
  }

  private transportationCreateData(dto: CreateTransportationDto): Prisma.TransportationUncheckedCreateInput {
    return {
      number: '', dealId: '', sequenceInDeal: 0, logistId: '',
      cargoName: this.text(dto.cargoName), placesCount: dto.placesCount, placesUnit: this.text(dto.placesUnit),
      weightKg: dto.weightKg, volumeM3: dto.volumeM3, cargoValue: dto.cargoValue,
      cargoValueCurrency: dto.cargoValueCurrency?.toUpperCase(), isDangerous: dto.isDangerous,
      isTempControlled: dto.isTempControlled, originPoint: dto.originPoint.trim(), destinationPoint: dto.destinationPoint.trim(),
      isDomestic: dto.isDomestic,
      transportMode: dto.transportMode, clientRate: dto.clientRate,
      clientRateCurrency: dto.clientRateCurrency?.toUpperCase(), plannedDeliveryDate: this.date(dto.plannedDeliveryDate),
      pickupEventDate: this.date(dto.pickupEventDate), unloadingEventDate: undefined,
      actualDeliveryDate: this.date(dto.actualDeliveryDate),
      shipperName: this.text(dto.shipperName), consigneeName: this.text(dto.consigneeName),
      loadingAddress: this.text(dto.loadingAddress), loadingDateTime: this.date(dto.loadingDateTime),
      loadingContactName: this.text(dto.loadingContactName), loadingContactPhone: this.text(dto.loadingContactPhone),
      unloadingAddress: this.text(dto.unloadingAddress), unloadingContactName: this.text(dto.unloadingContactName),
      unloadingContactPhone: this.text(dto.unloadingContactPhone), bodyType: this.text(dto.bodyType),
      accompanyingDocs: dto.accompanyingDocs, specialConditions: this.text(dto.specialConditions),
    };
  }

  private transportationUpdateData(dto: UpdateTransportationDto): Prisma.TransportationUncheckedUpdateInput {
    return this.removeUndefined({
      logistId: dto.logistId,
      cargoName: this.text(dto.cargoName), placesCount: dto.placesCount, placesUnit: this.text(dto.placesUnit),
      weightKg: dto.weightKg, volumeM3: dto.volumeM3, cargoValue: dto.cargoValue,
      cargoValueCurrency: dto.cargoValueCurrency?.toUpperCase(), isDangerous: dto.isDangerous,
      isTempControlled: dto.isTempControlled, originPoint: dto.originPoint?.trim(),
      destinationPoint: dto.destinationPoint?.trim(), isDomestic: dto.isDomestic,
      transportMode: dto.transportMode, clientRate: dto.clientRate,
      clientRateCurrency: dto.clientRateCurrency?.toUpperCase(), plannedDeliveryDate: this.date(dto.plannedDeliveryDate),
      pickupEventDate: this.date(dto.pickupEventDate), actualDeliveryDate: this.date(dto.actualDeliveryDate),
      shipperName: this.text(dto.shipperName), consigneeName: this.text(dto.consigneeName),
      loadingAddress: this.text(dto.loadingAddress), loadingDateTime: this.date(dto.loadingDateTime),
      loadingContactName: this.text(dto.loadingContactName), loadingContactPhone: this.text(dto.loadingContactPhone),
      unloadingAddress: this.text(dto.unloadingAddress), unloadingContactName: this.text(dto.unloadingContactName),
      unloadingContactPhone: this.text(dto.unloadingContactPhone), bodyType: this.text(dto.bodyType),
      accompanyingDocs: dto.accompanyingDocs, specialConditions: this.text(dto.specialConditions),
    });
  }

  private legCreateData(
    dto: UpdateTransportationLegDto,
    fromPoint: string,
    toPoint: string,
    mode: CreateTransportationLegDto['mode'],
  ): Prisma.TransportationLegUncheckedCreateWithoutTransportationInput {
    return {
      ...(this.legData(dto) as Prisma.TransportationLegUncheckedCreateWithoutTransportationInput),
      orderIndex: 0,
      fromPoint: dto.fromPoint?.trim() ?? fromPoint.trim(),
      toPoint: dto.toPoint?.trim() ?? toPoint.trim(),
      mode: dto.mode ?? mode,
    };
  }

  private legData(dto: UpdateTransportationLegDto): Prisma.TransportationLegUncheckedUpdateInput {
    return this.removeUndefined({
      fromPoint: dto.fromPoint?.trim(), toPoint: dto.toPoint?.trim(), mode: dto.mode,
      subcontractorId: dto.subcontractorId, subcontractorRate: dto.subcontractorRate,
      subcontractorRateCurrency: dto.subcontractorRateCurrency?.toUpperCase(),
      plannedStartDate: this.date(dto.plannedStartDate), plannedEndDate: this.date(dto.plannedEndDate),
      actualStartDate: this.date(dto.actualStartDate), actualEndDate: this.date(dto.actualEndDate),
      vehicleNumber: this.text(dto.vehicleNumber), trailerNumber: this.text(dto.trailerNumber), status: dto.status,
      driverFullName: this.text(dto.driverFullName), driverPhone: this.text(dto.driverPhone), driverIin: this.text(dto.driverIin),
      driverLicenseNumber: this.text(dto.driverLicenseNumber), driverLicenseDate: this.date(dto.driverLicenseDate),
      driverLicenseIssuer: this.text(dto.driverLicenseIssuer),
    });
  }

  private initialLegMode(dto: CreateTransportationDto): LegTransportMode {
    if (dto.initialLeg?.mode) return dto.initialLeg.mode;
    if (dto.transportMode === 'MULTIMODAL') return LegTransportMode.AUTO;
    return dto.transportMode;
  }

  private transportationModeFromLeg(mode: LegTransportMode) {
    if (mode === 'BROKER') throw new BadRequestException('Участок брокера нельзя использовать как общий вид транспорта');
    return mode;
  }

  private legModeFromTransportation(mode: CreateTransportationDto['transportMode']): LegTransportMode {
    if (mode === 'MULTIMODAL') {
      throw new BadRequestException('Для мультимодальной перевозки виды транспорта задаются по участкам');
    }
    return mode;
  }

  private removeUndefined<T extends object>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
  }

  private text(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value.trim() || null;
  }

  private date(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private creationChanges(row: TransportationWithRelations): Changes {
    return Object.fromEntries(Object.entries(this.snapshot(row)).map(([key, value]) => [key, { old: null, new: value }]));
  }

  private diff(oldRow: TransportationWithRelations, newRow: TransportationWithRelations): Changes {
    const oldSnapshot = this.snapshot(oldRow); const newSnapshot = this.snapshot(newRow); const changes: Changes = {};
    for (const key of Object.keys(oldSnapshot)) {
      if (JSON.stringify(oldSnapshot[key]) !== JSON.stringify(newSnapshot[key])) changes[key] = { old: oldSnapshot[key], new: newSnapshot[key] };
    }
    return changes;
  }

  private snapshot(row: TransportationWithRelations): Record<string, unknown> {
    const { deal, logist, legs, createdAt, updatedAt, ...values } = row;
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
  }

  private legSnapshot(leg: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(leg).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
  }

  private async writeAudit(tx: Prisma.TransactionClient, actorUserId: string, entityId: string, action: AuditAction, changes: Changes) {
    await tx.auditLog.create({
      data: { actorUserId, entityType: 'Transportation', entityId, action, changes: changes as Prisma.InputJsonValue },
    });
  }
}
