import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractorType,
  DealStage,
  LeadNotInterestedReason,
  LeadSource,
  LeadStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { ContractorsService } from '../contractors/contractors.service';
import { DealsService } from '../deals/deals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignLeadsDto } from './dto/assign-leads.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateWebsiteLeadDto } from './dto/create-website-lead.dto';
import { DistributeLeadsDto } from './dto/distribute-leads.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { TouchLeadDto } from './dto/touch-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { compareCallQueue, distributeRoundRobin, normalizePhone } from './leads-rules';

const leadListInclude = {
  responsible: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true } },
  matchedContractor: { select: { id: true, name: true } },
  convertedContractor: { select: { id: true, name: true } },
  convertedDeal: { select: { id: true, number: true } },
  importBatch: { select: { id: true, fileName: true, createdAt: true } },
} satisfies Prisma.LeadInclude;

const leadDetailInclude = {
  ...leadListInclude,
  activities: {
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.LeadInclude;

type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof leadListInclude }>;
type LeadWithActivities = Prisma.LeadGetPayload<{ include: typeof leadDetailInclude }>;

const MANAGE_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD'];

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractorsService: ContractorsService,
    private readonly dealsService: DealsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: LeadQueryDto, user: AuthUser): Promise<LeadWithRelations[]> {
    return this.prisma.lead.findMany({
      where: {
        AND: [
          this.visibilityWhere(user),
          {
            deletedAt: query.includeDeleted ? undefined : null,
            status: query.status,
            source: query.source,
            responsibleId: query.unassigned ? null : query.responsibleId,
            departmentId: query.departmentId,
            OR: query.search
              ? [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { phone: { contains: query.search, mode: 'insensitive' } },
                  { bin: { contains: query.search, mode: 'insensitive' } },
                ]
              : undefined,
          },
        ],
      },
      include: leadListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyCalls(user: AuthUser): Promise<LeadWithRelations[]> {
    const leads = await this.prisma.lead.findMany({
      where: {
        responsibleId: user.id,
        deletedAt: null,
        status: { notIn: [LeadStatus.CONVERTED, LeadStatus.NOT_INTERESTED] },
      },
      include: leadListInclude,
    });
    const today = new Date();
    return leads.sort((a, b) => compareCallQueue(a, b, today));
  }

  async findOne(id: string, user: AuthUser): Promise<LeadWithActivities> {
    return this.getVisibleLead(id, user);
  }

  async import(dto: ImportLeadsDto, user: AuthUser) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Недостаточно прав для импорта базы лидов');
    }
    const departmentId = this.resolveDepartmentForManage(user, dto.departmentId);
    if (departmentId) await this.ensureDepartment(departmentId);

    const [contractors, existingLeads] = await Promise.all([
      this.prisma.contractor.findMany({
        where: { deletedAt: null, OR: [{ phone: { not: null } }, { bin: { not: null } }] },
        select: { id: true, phone: true, bin: true },
      }),
      this.prisma.lead.findMany({
        where: { deletedAt: null, status: { not: LeadStatus.CONVERTED } },
        select: { phone: true, bin: true },
      }),
    ]);

    const contractorByPhone = new Map(
      contractors.filter((c) => normalizePhone(c.phone)).map((c) => [normalizePhone(c.phone) as string, c.id]),
    );
    const contractorByBin = new Map(contractors.filter((c) => c.bin).map((c) => [c.bin as string, c.id]));
    const existingPhones = new Set(
      existingLeads.map((l) => normalizePhone(l.phone)).filter((v): v is string => Boolean(v)),
    );
    const existingBins = new Set(existingLeads.map((l) => l.bin).filter((v): v is string => Boolean(v)));
    const seenInBatch = new Set<string>();

    const toCreate: Prisma.LeadCreateManyInput[] = [];
    let duplicateLead = 0;
    let existingClient = 0;

    for (const row of dto.rows) {
      if (!row.name?.trim()) continue;
      const phoneKey = normalizePhone(row.phone);
      const binKey = row.bin?.trim() || null;

      const isDuplicate =
        (phoneKey !== null && (seenInBatch.has(`p:${phoneKey}`) || existingPhones.has(phoneKey))) ||
        (binKey !== null && (seenInBatch.has(`b:${binKey}`) || existingBins.has(binKey)));
      if (isDuplicate) {
        duplicateLead += 1;
        continue;
      }
      if (phoneKey !== null) seenInBatch.add(`p:${phoneKey}`);
      if (binKey !== null) seenInBatch.add(`b:${binKey}`);

      const matchedContractorId =
        (phoneKey !== null ? contractorByPhone.get(phoneKey) : undefined) ??
        (binKey !== null ? contractorByBin.get(binKey) : undefined) ??
        null;
      if (matchedContractorId) existingClient += 1;

      toCreate.push({
        name: row.name.trim(),
        phone: row.phone?.trim() || null,
        bin: binKey,
        city: row.city?.trim() || null,
        contactName: row.contactName?.trim() || null,
        email: row.email?.trim() || null,
        notes: row.notes?.trim() || null,
        departmentId,
        isExistingClient: Boolean(matchedContractorId),
        matchedContractorId,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.leadImportBatch.create({
        data: {
          fileName: dto.fileName,
          importedByUserId: user.id,
          rowsTotal: dto.rows.length,
          rowsCreated: toCreate.length,
          rowsExistingClient: existingClient,
          rowsDuplicateLead: duplicateLead,
        },
      });
      if (toCreate.length) {
        await tx.lead.createMany({
          data: toCreate.map((row) => ({ ...row, importBatchId: batch.id })),
        });
      }
      return batch;
    });
  }

  async findImportBatches(user: AuthUser) {
    const departmentId = this.resolveDepartmentForManage(user, undefined);
    return this.prisma.leadImportBatch.findMany({
      where: departmentId ? { leads: { some: { departmentId } } } : undefined,
      include: { importedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Создание лида из заявки сайта (раздел 4.6.3 ТЗ) — источник WEBSITE, без отдела/ответственного, распределяет админ/директор. */
  async createFromWebsite(dto: CreateWebsiteLeadDto): Promise<void> {
    const phoneKey = normalizePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;

    let matchedContractorId: string | null = null;
    if (phoneKey) {
      const candidates = await this.prisma.contractor.findMany({
        where: { deletedAt: null, phone: { not: null } },
        select: { id: true, phone: true },
      });
      matchedContractorId = candidates.find((c) => normalizePhone(c.phone) === phoneKey)?.id ?? null;
    }
    if (!matchedContractorId && email) {
      const byEmail = await this.prisma.contractor.findFirst({
        where: { deletedAt: null, email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      matchedContractorId = byEmail?.id ?? null;
    }

    const notesParts = [dto.comment?.trim(), dto.page ? `Страница: ${dto.page}` : null].filter(Boolean);

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        routeFrom: dto.routeFrom?.trim() || null,
        routeTo: dto.routeTo?.trim() || null,
        cargoDescription: dto.cargoDescription?.trim() || null,
        notes: notesParts.length ? notesParts.join('. ') : null,
        source: LeadSource.WEBSITE,
        sourcePage: dto.page?.trim() || null,
        sourceLanguage: dto.language ?? null,
        utmSource: dto.utm?.source?.trim() || null,
        utmMedium: dto.utm?.medium?.trim() || null,
        utmCampaign: dto.utm?.campaign?.trim() || null,
        utmContent: dto.utm?.content?.trim() || null,
        utmTerm: dto.utm?.term?.trim() || null,
        isExistingClient: Boolean(matchedContractorId),
        matchedContractorId,
      },
    });

    const managers = await this.prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { code: 'MANAGER' } } } },
      select: { id: true },
    });
    if (managers.length) {
      await this.notificationsService.notifyMany(
        managers.map((manager) => manager.id),
        NotificationType.WEBSITE_LEAD_RECEIVED,
        'Новая заявка с сайта',
        `Заявка с сайта: ${lead.name}`,
        'Lead',
        lead.id,
      );
    }
  }

  /** Отчёт «скорость реакции на заявки» с сайта (раздел 4.6.3 ТЗ) — время от поступления до первого действия менеджера. */
  async getReactionTimeReport(user: AuthUser): Promise<{
    averageMinutes: number | null;
    items: Array<{
      id: string;
      name: string;
      createdAt: Date;
      firstHandledAt: Date | null;
      responsible: { id: string; fullName: string } | null;
    }>;
  }> {
    const leads = await this.prisma.lead.findMany({
      where: { AND: [{ source: LeadSource.WEBSITE, deletedAt: null }, this.visibilityWhere(user)] },
      select: {
        id: true,
        name: true,
        createdAt: true,
        firstHandledAt: true,
        responsible: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const handledMinutes = leads
      .filter((lead) => lead.firstHandledAt)
      .map((lead) => (lead.firstHandledAt!.getTime() - lead.createdAt.getTime()) / 60000);
    const averageMinutes = handledMinutes.length
      ? handledMinutes.reduce((sum, value) => sum + value, 0) / handledMinutes.length
      : null;
    return { averageMinutes, items: leads };
  }

  async update(id: string, dto: UpdateLeadDto, user: AuthUser): Promise<LeadWithActivities> {
    await this.getVisibleLead(id, user);
    const data: Prisma.LeadUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.bin !== undefined) data.bin = dto.bin.trim() || null;
    if (dto.city !== undefined) data.city = dto.city.trim() || null;
    if (dto.contactName !== undefined) data.contactName = dto.contactName.trim() || null;
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    return this.prisma.lead.update({ where: { id }, data, include: leadDetailInclude });
  }

  async assign(dto: AssignLeadsDto, user: AuthUser): Promise<{ updated: number }> {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Недостаточно прав для назначения лидов');
    }
    await this.ensureActiveUser(dto.responsibleId);
    const visibleIds = await this.visibleLeadIds(dto.leadIds, user);
    if (!visibleIds.length) return { updated: 0 };

    const result = await this.prisma.lead.updateMany({
      where: { id: { in: visibleIds } },
      data: { responsibleId: dto.responsibleId },
    });
    await this.notificationsService.notify(
      dto.responsibleId,
      NotificationType.RESPONSIBLE_ASSIGNED,
      'Вам назначены лиды',
      `Вам назначено лидов: ${visibleIds.length}`,
      'Lead',
      visibleIds[0],
    );
    return { updated: result.count };
  }

  async distribute(dto: DistributeLeadsDto, user: AuthUser): Promise<{ updated: number }> {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Недостаточно прав для распределения лидов');
    }
    await Promise.all(dto.managerIds.map((id) => this.ensureActiveUser(id)));
    const visibleIds = await this.visibleLeadIds(dto.leadIds, user);
    if (!visibleIds.length) return { updated: 0 };

    const assignments = distributeRoundRobin(visibleIds, dto.managerIds);
    await this.prisma.$transaction(
      assignments.map(({ leadId, responsibleId }) =>
        this.prisma.lead.update({ where: { id: leadId }, data: { responsibleId } }),
      ),
    );
    const perManagerCount = new Map<string, number>();
    for (const { responsibleId } of assignments) {
      perManagerCount.set(responsibleId, (perManagerCount.get(responsibleId) ?? 0) + 1);
    }
    await Promise.all(
      [...perManagerCount.entries()].map(([responsibleId, count]) =>
        this.notificationsService.notify(
          responsibleId,
          NotificationType.RESPONSIBLE_ASSIGNED,
          'Вам назначены лиды',
          `Вам назначено лидов: ${count}`,
          'Lead',
          assignments.find((a) => a.responsibleId === responsibleId)!.leadId,
        ),
      ),
    );
    return { updated: assignments.length };
  }

  async touch(id: string, dto: TouchLeadDto, user: AuthUser): Promise<LeadWithActivities> {
    const lead = await this.getVisibleLead(id, user);
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Лид уже конвертирован — изменить статус нельзя');
    }
    const data: Prisma.LeadUpdateInput = { status: dto.status };
    if (!lead.firstHandledAt) data.firstHandledAt = new Date();
    if (dto.status === LeadStatus.CALL_BACK) {
      data.callBackAt = new Date(dto.callBackAt as string);
    } else {
      data.callBackAt = null;
    }
    if (dto.status === LeadStatus.NOT_REACHED) {
      data.notReachedAttempts = lead.notReachedAttempts + 1;
    }
    if (dto.status === LeadStatus.NOT_INTERESTED) {
      data.notInterestedReason = dto.notInterestedReason as LeadNotInterestedReason;
      data.notInterestedComment =
        dto.notInterestedReason === LeadNotInterestedReason.OTHER ? dto.notInterestedComment?.trim() || null : null;
    } else {
      data.notInterestedReason = null;
      data.notInterestedComment = null;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data });
      await tx.leadActivity.create({
        data: {
          leadId: id,
          userId: user.id,
          fromStatus: lead.status,
          toStatus: dto.status,
          comment: dto.comment.trim(),
          callBackAt: dto.status === LeadStatus.CALL_BACK ? new Date(dto.callBackAt as string) : null,
        },
      });
      return tx.lead.findUniqueOrThrow({ where: { id }, include: leadDetailInclude });
    });
  }

  async convert(id: string, dto: ConvertLeadDto, user: AuthUser): Promise<LeadWithActivities> {
    const lead = await this.getVisibleLead(id, user);
    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Лид уже конвертирован');
    }
    if (!lead.responsibleId) {
      throw new BadRequestException('У лида нет ответственного — сначала назначьте лид менеджеру');
    }
    const legalEntity = await this.prisma.legalEntity.findFirst({
      where: { id: dto.legalEntityId, isActive: true },
      select: { id: true },
    });
    if (!legalEntity) throw new BadRequestException('Активное юрлицо не найдено');

    const contractor = await this.contractorsService.create(
      {
        name: lead.name,
        types: [ContractorType.CLIENT],
        bin: lead.bin ?? undefined,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
        notes: lead.notes ?? undefined,
      },
      user.id,
    );
    const deal = await this.dealsService.create(
      {
        clientId: contractor.id,
        legalEntityId: dto.legalEntityId,
        responsibleId: lead.responsibleId,
        departmentId: lead.departmentId ?? undefined,
      },
      user,
    );
    await this.dealsService.updateStage(deal.id, { stage: DealStage.RATE_CALCULATION }, user);

    return this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.CONVERTED,
          convertedContractorId: contractor.id,
          convertedDealId: deal.id,
          firstHandledAt: lead.firstHandledAt ?? new Date(),
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId: id,
          userId: user.id,
          fromStatus: lead.status,
          toStatus: LeadStatus.CONVERTED,
          comment: `Конвертирован в контрагента «${contractor.name}» и сделку ${deal.number}`,
        },
      });
      return tx.lead.findUniqueOrThrow({ where: { id }, include: leadDetailInclude });
    });
  }

  private canManage(user: AuthUser): boolean {
    return user.roles.some((role) => MANAGE_ROLES.includes(role));
  }

  private resolveDepartmentForManage(user: AuthUser, requestedDepartmentId?: string): string | null {
    const isDepartmentHeadOnly =
      user.roles.includes('DEPARTMENT_HEAD') &&
      !user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role));
    if (isDepartmentHeadOnly) return user.departmentId ?? null;
    return requestedDepartmentId ?? null;
  }

  private visibilityWhere(user: AuthUser): Prisma.LeadWhereInput {
    if (user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role))) return {};
    const conditions: Prisma.LeadWhereInput[] = [];
    if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
      conditions.push({ departmentId: user.departmentId });
    }
    if (user.roles.includes('MANAGER')) {
      conditions.push({ responsibleId: user.id });
    }
    return conditions.length ? { OR: conditions } : { id: { in: [] } };
  }

  private async visibleLeadIds(leadIds: string[], user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.lead.findMany({
      where: { AND: [{ id: { in: leadIds } }, this.visibilityWhere(user), { deletedAt: null }] },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async getVisibleLead(id: string, user: AuthUser): Promise<LeadWithActivities> {
    const exists = await this.prisma.lead.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Лид не найден');
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ id }, this.visibilityWhere(user)] },
      include: leadDetailInclude,
    });
    if (!lead) throw new ForbiddenException('Нет доступа к этому лиду');
    return lead;
  }

  private async ensureActiveUser(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!user) throw new BadRequestException('Активный пользователь не найден');
  }

  private async ensureDepartment(id: string): Promise<void> {
    const department = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!department) throw new BadRequestException('Отдел не найден');
  }
}
