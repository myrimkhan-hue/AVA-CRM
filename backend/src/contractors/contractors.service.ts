import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, PaymentTerm, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { transportationVisibilityWhere } from '../transportations/transportation-policy';
import { ContractorBankAccountDto } from './dto/contractor-bank-account.dto';
import { ContractorContactDto } from './dto/contractor-contact.dto';
import { ContractorQueryDto, DuplicateQueryDto } from './dto/contractor-query.dto';
import { ContractorTransportationDto } from './dto/contractor-transportation.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

const contractorInclude = {
  contacts: true,
  bankAccounts: true,
} satisfies Prisma.ContractorInclude;

type ContractorWithRelations = Prisma.ContractorGetPayload<{
  include: typeof contractorInclude;
}>;
type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class ContractorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ContractorQueryDto, roles: string[]): Promise<ContractorWithRelations[]> {
    if (query.includeDeleted && !roles.includes('ADMIN')) {
      throw new ForbiddenException('Просмотр удалённых контрагентов доступен только администратору');
    }
    const search = query.search?.trim();
    return this.prisma.contractor.findMany({
      where: {
        deletedAt: query.includeDeleted ? undefined : null,
        types: query.type ? { has: query.type } : undefined,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { bin: { contains: search, mode: 'insensitive' } },
              { contacts: { some: { phone: { contains: search, mode: 'insensitive' } } } },
              { contacts: { some: { fullName: { contains: search, mode: 'insensitive' } } } },
            ]
          : undefined,
      },
      include: contractorInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findDuplicates(query: DuplicateQueryDto): Promise<Array<{ id: string; name: string; bin: string | null }>> {
    const bin = query.bin?.trim();
    const normalizedName = this.normalizeName(query.name);
    if (!bin && !normalizedName) return [];
    const conditions: Prisma.Sql[] = [];
    if (bin) conditions.push(Prisma.sql`bin = ${bin}`);
    if (normalizedName) {
      conditions.push(
        Prisma.sql`regexp_replace(lower(name), '[[:space:]]+', '', 'g') = ${normalizedName}`,
      );
    }
    return this.prisma.$queryRaw<Array<{ id: string; name: string; bin: string | null }>>(
      Prisma.sql`
        SELECT id, name, bin
        FROM contractors
        WHERE deleted_at IS NULL
          ${query.excludeId ? Prisma.sql`AND id <> ${query.excludeId}` : Prisma.empty}
          AND (${Prisma.join(conditions, ' OR ')})
        ORDER BY name ASC
      `,
    );
  }

  async findOne(id: string, roles: string[]): Promise<ContractorWithRelations> {
    const contractor = await this.getContractor(id);
    if (contractor.deletedAt && !roles.includes('ADMIN')) {
      throw new NotFoundException('Контрагент не найден');
    }
    return contractor;
  }

  async findTransportations(id: string, user: AuthUser): Promise<ContractorTransportationDto[]> {
    await this.findOne(id, user.roles);
    const rows = await this.prisma.transportation.findMany({
      where: {
        AND: [
          transportationVisibilityWhere(user),
          { deletedAt: null },
          {
            OR: [
              { deal: { clientId: id } },
              { legs: { some: { subcontractorId: id } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        number: true,
        originPoint: true,
        destinationPoint: true,
        status: true,
        deal: { select: { clientId: true } },
        legs: {
          where: { subcontractorId: id },
          select: { orderIndex: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(({ deal, legs, ...transportation }) => ({
      ...transportation,
      role: {
        isClient: deal.clientId === id,
        legOrderIndexes: legs.map((leg) => leg.orderIndex),
      },
    }));
  }

  async create(dto: CreateContractorDto, actorUserId: string): Promise<ContractorWithRelations> {
    this.validateBusinessRules(dto);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.contractor.create({
        data: {
          ...this.scalarData(dto),
          contacts: dto.contacts?.length ? { create: dto.contacts.map((item) => this.contactData(item)) } : undefined,
          bankAccounts: dto.bankAccounts?.length
            ? { create: dto.bankAccounts.map((item) => this.bankAccountData(item)) }
            : undefined,
        },
        include: contractorInclude,
      });
      await this.writeAudit(tx, actorUserId, created.id, AuditAction.CREATE, this.creationChanges(created));
      return created;
    });
  }

  async update(id: string, dto: UpdateContractorDto, actorUserId: string): Promise<ContractorWithRelations> {
    const current = await this.getActiveContractor(id);
    this.validateBusinessRules(dto, current);
    const data: Prisma.ContractorUpdateInput = this.scalarData(dto);
    if (dto.contacts !== undefined) {
      data.contacts = {
        deleteMany: {},
        create: dto.contacts.map((item) => this.contactData(item)),
      };
    }
    if (dto.bankAccounts !== undefined) {
      data.bankAccounts = {
        deleteMany: {},
        create: dto.bankAccounts.map((item) => this.bankAccountData(item)),
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contractor.update({
        where: { id },
        data,
        include: contractorInclude,
      });
      await this.writeAudit(tx, actorUserId, id, AuditAction.UPDATE, this.updateChanges(current, updated, dto));
      return updated;
    });
  }

  async remove(id: string, actorUserId: string): Promise<ContractorWithRelations> {
    const current = await this.getContractor(id);
    if (current.deletedAt) throw new BadRequestException('Контрагент уже удалён');
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.contractor.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: contractorInclude,
      });
      await this.writeAudit(tx, actorUserId, id, AuditAction.DELETE, {
        deletedAt: { old: null, new: deleted.deletedAt?.toISOString() ?? null },
      });
      return deleted;
    });
  }

  async restore(id: string, actorUserId: string): Promise<ContractorWithRelations> {
    const current = await this.getContractor(id);
    if (!current.deletedAt) throw new BadRequestException('Контрагент не удалён');
    const deletedAt = current.deletedAt;
    return this.prisma.$transaction(async (tx) => {
      const restored = await tx.contractor.update({
        where: { id },
        data: { deletedAt: null },
        include: contractorInclude,
      });
      await this.writeAudit(tx, actorUserId, id, AuditAction.RESTORE, {
        deletedAt: { old: deletedAt.toISOString(), new: null },
      });
      return restored;
    });
  }

  private async getContractor(id: string): Promise<ContractorWithRelations> {
    const contractor = await this.prisma.contractor.findUnique({ where: { id }, include: contractorInclude });
    if (!contractor) throw new NotFoundException('Контрагент не найден');
    return contractor;
  }

  private async getActiveContractor(id: string): Promise<ContractorWithRelations> {
    const contractor = await this.getContractor(id);
    if (contractor.deletedAt) throw new BadRequestException('Нельзя изменить удалённого контрагента');
    return contractor;
  }

  private validateBusinessRules(
    dto: CreateContractorDto | UpdateContractorDto,
    current?: ContractorWithRelations,
  ): void {
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Укажите название контрагента');
    }
    const paymentTerm = dto.paymentTerm ?? current?.paymentTerm;
    const days = dto.postpaymentDays ?? current?.postpaymentDays;
    if (paymentTerm === PaymentTerm.POSTPAYMENT && (!Number.isInteger(days) || (days ?? 0) <= 0)) {
      throw new BadRequestException('Для постоплаты укажите количество дней больше нуля');
    }
    if (paymentTerm !== PaymentTerm.POSTPAYMENT && dto.postpaymentDays !== undefined) {
      throw new BadRequestException('Количество дней указывается только для постоплаты');
    }
    const isBlacklisted = dto.isBlacklisted ?? current?.isBlacklisted ?? false;
    const reason = dto.blacklistReason ?? current?.blacklistReason;
    if (isBlacklisted && !reason?.trim()) {
      throw new BadRequestException('Укажите причину добавления в чёрный список');
    }
  }

  private scalarData(dto: CreateContractorDto | UpdateContractorDto): Prisma.ContractorUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    const textFields = ['name', 'bin', 'country', 'legalAddress', 'notes', 'problemComment', 'blacklistReason'] as const;
    for (const field of textFields) {
      if (dto[field] !== undefined) data[field] = dto[field]?.trim() || null;
    }
    if (dto.types !== undefined) data.types = [...new Set(dto.types)];
    if (dto.paymentTerm !== undefined) {
      data.paymentTerm = dto.paymentTerm;
      if (dto.paymentTerm !== PaymentTerm.POSTPAYMENT) data.postpaymentDays = null;
    }
    if (dto.postpaymentDays !== undefined && dto.paymentTerm !== PaymentTerm.PREPAYMENT) {
      data.postpaymentDays = dto.postpaymentDays;
    }
    if (dto.isProblem !== undefined) data.isProblem = dto.isProblem;
    if (dto.isBlacklisted !== undefined) {
      data.isBlacklisted = dto.isBlacklisted;
      if (!dto.isBlacklisted) data.blacklistReason = null;
    }
    return data as Prisma.ContractorUncheckedCreateInput;
  }

  private contactData(item: ContractorContactDto): Prisma.ContractorContactCreateWithoutContractorInput {
    return {
      fullName: item.fullName.trim(),
      position: item.position?.trim() || null,
      phone: item.phone?.trim() || null,
      email: item.email?.trim().toLowerCase() || null,
      whatsapp: item.whatsapp?.trim() || null,
    };
  }

  private bankAccountData(item: ContractorBankAccountDto): Prisma.ContractorBankAccountCreateWithoutContractorInput {
    return {
      bankName: item.bankName.trim(),
      accountNumber: item.accountNumber.trim(),
      currency: item.currency.trim().toUpperCase(),
      notes: item.notes?.trim() || null,
    };
  }

  private creationChanges(contractor: ContractorWithRelations): Changes {
    const changes: Changes = {};
    for (const [key, value] of Object.entries(this.auditSnapshot(contractor))) {
      changes[key] = { old: key === 'contacts' || key === 'bankAccounts' ? [] : null, new: value };
    }
    return changes;
  }

  private updateChanges(
    oldValue: ContractorWithRelations,
    newValue: ContractorWithRelations,
    dto: UpdateContractorDto,
  ): Changes {
    const oldSnapshot = this.auditSnapshot(oldValue);
    const newSnapshot = this.auditSnapshot(newValue);
    const changes: Changes = {};
    for (const key of Object.keys(oldSnapshot)) {
      if (JSON.stringify(oldSnapshot[key]) !== JSON.stringify(newSnapshot[key])) {
        changes[key] = { old: oldSnapshot[key], new: newSnapshot[key] };
      }
    }
    return changes;
  }

  private auditSnapshot(contractor: ContractorWithRelations): Record<string, unknown> {
    return {
      name: contractor.name,
      types: contractor.types,
      bin: contractor.bin,
      country: contractor.country,
      legalAddress: contractor.legalAddress,
      paymentTerm: contractor.paymentTerm,
      postpaymentDays: contractor.postpaymentDays,
      notes: contractor.notes,
      isProblem: contractor.isProblem,
      problemComment: contractor.problemComment,
      isBlacklisted: contractor.isBlacklisted,
      blacklistReason: contractor.blacklistReason,
      contacts: contractor.contacts.map(({ id: _id, contractorId: _contractorId, ...item }) => item),
      bankAccounts: contractor.bankAccounts.map(({ id: _id, contractorId: _contractorId, ...item }) => item),
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
        entityType: 'Contractor',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private normalizeName(value?: string): string {
    return value?.toLocaleLowerCase('ru').replace(/\s+/g, '') ?? '';
  }
}
