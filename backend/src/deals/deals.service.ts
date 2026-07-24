import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, DealRejectReason, DealStage, NotificationType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { canSeeTransportationClientRate } from '../transportations/transportation-policy';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { MarginService } from './margin.service';

const dealInclude = {
  client: { select: { id: true, name: true } },
  legalEntity: { select: { id: true, name: true, numberingPrefix: true } },
  responsible: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { transportations: { where: { deletedAt: null } } } },
} satisfies Prisma.DealInclude;

type DealWithRelations = Prisma.DealGetPayload<{ include: typeof dealInclude }>;
type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marginService: MarginService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: DealQueryDto, user: AuthUser): Promise<DealWithRelations[]> {
    if (query.includeDeleted && !user.roles.includes('ADMIN')) {
      throw new ForbiddenException('Просмотр удалённых сделок доступен только администратору');
    }
    const search = query.search?.trim();
    return this.prisma.deal.findMany({
      where: {
        AND: [
          this.visibilityWhere(user),
          {
            deletedAt: query.includeDeleted ? undefined : null,
            stage: query.stage,
            clientId: query.clientId,
            legalEntityId: query.legalEntityId,
            responsibleId: query.responsibleId,
            OR: search
              ? [
                  { number: { contains: search, mode: 'insensitive' } },
                  { client: { name: { contains: search, mode: 'insensitive' } } },
                ]
              : undefined,
          },
        ],
      },
      include: dealInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser): Promise<DealWithRelations> {
    return this.getVisibleDeal(id, user, user.roles.includes('ADMIN'));
  }

  async getMargin(id: string, user: AuthUser) {
    if (!canSeeTransportationClientRate(user)) {
      throw new ForbiddenException('Нет доступа к финансовым показателям сделки');
    }
    await this.getVisibleDeal(id, user);
    const transportations = await this.prisma.transportation.findMany({
      where: { dealId: id, deletedAt: null },
      select: { id: true },
    });
    return this.marginService.calculateForTransportations(
      transportations.map((row) => row.id),
    );
  }

  async create(dto: CreateDealDto, user: AuthUser): Promise<DealWithRelations> {
    const responsibleId = dto.responsibleId ?? user.id;
    if (this.isManagerOnly(user) && responsibleId !== user.id) {
      throw new ForbiddenException('Менеджер может создавать сделки только на себя');
    }
    const [client, legalEntity, responsible] = await Promise.all([
      this.prisma.contractor.findFirst({ where: { id: dto.clientId, deletedAt: null }, select: { id: true } }),
      this.prisma.legalEntity.findFirst({ where: { id: dto.legalEntityId, isActive: true } }),
      this.prisma.user.findFirst({
        where: { id: responsibleId, isActive: true },
        select: { id: true, departmentId: true },
      }),
    ]);
    if (!client) throw new BadRequestException('Активный клиент не найден');
    if (!legalEntity) throw new BadRequestException('Активное юрлицо не найдено');
    if (!responsible) throw new BadRequestException('Активный ответственный не найден');
    const departmentId = dto.departmentId ?? responsible.departmentId;
    await this.ensureDepartment(departmentId);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const year = new Date().getFullYear();
          const sequence = await tx.dealNumberSequence.upsert({
            where: { legalEntityId_year: { legalEntityId: legalEntity.id, year } },
            create: { legalEntityId: legalEntity.id, year, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          });
          const number = `${legalEntity.numberingPrefix}-${year}-${String(sequence.lastNumber).padStart(4, '0')}`;
          const created = await tx.deal.create({
            data: {
              number,
              clientId: client.id,
              legalEntityId: legalEntity.id,
              responsibleId,
              departmentId,
              notes: dto.notes?.trim() || null,
            },
            include: dealInclude,
          });
          await this.writeAudit(tx, user.id, created.id, AuditAction.CREATE, this.creationChanges(created));
          return created;
        });
        if (created.responsibleId !== user.id) {
          await this.notificationsService.notify(
            created.responsibleId,
            NotificationType.RESPONSIBLE_ASSIGNED,
            'Вам назначена сделка',
            `Вы назначены ответственным по сделке ${created.number}`,
            'Deal',
            created.id,
          );
        }
        return created;
      } catch (error: unknown) {
        if (this.isUniqueConflict(error) && attempt < 3) continue;
        if (this.isUniqueConflict(error)) {
          throw new BadRequestException('Не удалось сформировать уникальный номер сделки');
        }
        throw error;
      }
    }
    throw new BadRequestException('Не удалось создать сделку');
  }

  async update(id: string, dto: UpdateDealDto, user: AuthUser): Promise<DealWithRelations> {
    const current = await this.getActiveVisibleDeal(id, user);
    if (dto.responsibleId !== undefined && !this.canAssignResponsible(user)) {
      throw new ForbiddenException('Недостаточно прав для переназначения ответственного');
    }
    if (dto.responsibleId !== undefined) await this.ensureResponsible(dto.responsibleId);
    if (dto.departmentId !== undefined) await this.ensureDepartment(dto.departmentId);
    const data: Prisma.DealUncheckedUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.responsibleId !== undefined) data.responsibleId = dto.responsibleId;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({ where: { id }, data, include: dealInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, this.diff(current, updated));
      return updated;
    });
    if (
      dto.responsibleId !== undefined &&
      dto.responsibleId !== current.responsibleId &&
      dto.responsibleId !== user.id
    ) {
      await this.notificationsService.notify(
        updated.responsibleId,
        NotificationType.RESPONSIBLE_ASSIGNED,
        'Вам назначена сделка',
        `Вы назначены ответственным по сделке ${updated.number}`,
        'Deal',
        updated.id,
      );
    }
    return updated;
  }

  async updateStage(id: string, dto: UpdateDealStageDto, user: AuthUser): Promise<DealWithRelations> {
    const current = await this.getActiveVisibleDeal(id, user);
    if (dto.stage === DealStage.REJECTED) {
      if (!dto.rejectReason) throw new BadRequestException('Укажите причину отказа');
      if (dto.rejectReason === DealRejectReason.OTHER && !dto.rejectComment?.trim()) {
        throw new BadRequestException('Для причины «Другое» укажите комментарий');
      }
    }
    const data: Prisma.DealUpdateInput = {
      stage: dto.stage,
      rejectReason: dto.stage === DealStage.REJECTED ? dto.rejectReason : null,
      rejectComment: dto.stage === DealStage.REJECTED ? dto.rejectComment?.trim() || null : null,
    };
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({ where: { id }, data, include: dealInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.UPDATE, this.diff(current, updated));
      return updated;
    });
  }

  async remove(id: string, user: AuthUser): Promise<DealWithRelations> {
    const current = await this.getVisibleDeal(id, user, true);
    if (current.deletedAt) throw new BadRequestException('Сделка уже удалена');
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.deal.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: dealInclude,
      });
      await this.writeAudit(tx, user.id, id, AuditAction.DELETE, {
        deletedAt: { old: null, new: deleted.deletedAt?.toISOString() ?? null },
      });
      return deleted;
    });
  }

  async restore(id: string, user: AuthUser): Promise<DealWithRelations> {
    const current = await this.getVisibleDeal(id, user, true);
    if (!current.deletedAt) throw new BadRequestException('Сделка не удалена');
    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.deal.update({ where: { id }, data: { deletedAt: null }, include: dealInclude });
      await this.writeAudit(tx, user.id, id, AuditAction.RESTORE, {
        deletedAt: { old: current.deletedAt?.toISOString() ?? null, new: null },
      });
      return restored;
    });
  }

  private visibilityWhere(user: AuthUser): Prisma.DealWhereInput {
    if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role))) return {};
    const conditions: Prisma.DealWhereInput[] = [];
    if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
      conditions.push({ departmentId: user.departmentId });
    }
    if (user.roles.includes('DEPARTMENT_HEAD') || user.roles.includes('MANAGER')) {
      conditions.push({ responsibleId: user.id });
    }
    return conditions.length ? { OR: conditions } : { id: { in: [] } };
  }

  private async getVisibleDeal(id: string, user: AuthUser, includeDeleted = false): Promise<DealWithRelations> {
    const exists = await this.prisma.deal.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Сделка не найдена');
    const deal = await this.prisma.deal.findFirst({
      where: { AND: [{ id }, this.visibilityWhere(user), { deletedAt: includeDeleted ? undefined : null }] },
      include: dealInclude,
    });
    if (!deal) throw new ForbiddenException('Нет доступа к этой сделке');
    return deal;
  }

  private async getActiveVisibleDeal(id: string, user: AuthUser): Promise<DealWithRelations> {
    const deal = await this.getVisibleDeal(id, user, true);
    if (deal.deletedAt) throw new BadRequestException('Нельзя изменить удалённую сделку');
    return deal;
  }

  private async ensureResponsible(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!user) throw new BadRequestException('Активный ответственный не найден');
  }

  private async ensureDepartment(id: string | null | undefined): Promise<void> {
    if (!id) return;
    const department = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!department) throw new BadRequestException('Отдел не найден');
  }

  private isManagerOnly(user: AuthUser): boolean {
    return user.roles.includes('MANAGER') && !user.roles.some((role) =>
      ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'].includes(role),
    );
  }

  private canAssignResponsible(user: AuthUser): boolean {
    return user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'].includes(role));
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private creationChanges(deal: DealWithRelations): Changes {
    const changes: Changes = {};
    for (const [key, value] of Object.entries(this.snapshot(deal))) changes[key] = { old: null, new: value };
    return changes;
  }

  private diff(oldDeal: DealWithRelations, newDeal: DealWithRelations): Changes {
    const oldSnapshot = this.snapshot(oldDeal);
    const newSnapshot = this.snapshot(newDeal);
    const changes: Changes = {};
    for (const key of Object.keys(oldSnapshot)) {
      if (oldSnapshot[key] !== newSnapshot[key]) changes[key] = { old: oldSnapshot[key], new: newSnapshot[key] };
    }
    return changes;
  }

  private snapshot(deal: DealWithRelations): Record<string, unknown> {
    return {
      number: deal.number,
      legalEntityId: deal.legalEntityId,
      clientId: deal.clientId,
      responsibleId: deal.responsibleId,
      departmentId: deal.departmentId,
      stage: deal.stage,
      rejectReason: deal.rejectReason,
      rejectComment: deal.rejectComment,
      notes: deal.notes,
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
      data: { actorUserId, entityType: 'Deal', entityId, action, changes: changes as Prisma.InputJsonValue },
    });
  }
}
