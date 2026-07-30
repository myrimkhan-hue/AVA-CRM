import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentEntityType, ContractStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { daysUntilExpiry, resolveContractStatus } from './contract-rules';

const contractInclude = {
  contractor: { select: { id: true, name: true } },
  legalEntity: { select: { id: true, name: true, numberingPrefix: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ContractInclude;

type ContractRow = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ContractQueryDto) {
    const search = query.search?.trim();
    const rows = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        contractorId: query.contractorId,
        legalEntityId: query.legalEntityId,
        OR: search
          ? [
              { number: { contains: search, mode: 'insensitive' } },
              { contractor: { name: { contains: search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: contractInclude,
      orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const presented = rows.map((row) => this.present(row));
    // Статус вычисляемый, поэтому фильтр по нему применяется уже к результату.
    return query.status ? presented.filter((row) => row.status === query.status) : presented;
  }

  async findOne(id: string) {
    const row = await this.prisma.contract.findFirst({ where: { id, deletedAt: null }, include: contractInclude });
    if (!row) throw new NotFoundException('Договор не найден');
    return this.present(row);
  }

  async create(dto: CreateContractDto, user: AuthUser) {
    await this.ensureRefs(dto.contractorId, dto.legalEntityId);
    const signedAt = this.parseDate(dto.signedAt, 'Дата договора');
    const validUntil = dto.validUntil ? this.parseDate(dto.validUntil, 'Срок действия') : null;
    if (validUntil && validUntil.getTime() < signedAt.getTime()) {
      throw new BadRequestException('Срок действия раньше даты договора');
    }
    const row = await this.prisma.contract.create({
      data: {
        contractorId: dto.contractorId,
        legalEntityId: dto.legalEntityId,
        number: dto.number.trim(),
        signedAt,
        validUntil,
        subject: dto.subject?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: user.id,
      },
      include: contractInclude,
    });
    return this.present(row);
  }

  async update(id: string, dto: UpdateContractDto) {
    const current = await this.prisma.contract.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Договор не найден');

    const data: Prisma.ContractUncheckedUpdateInput = {};
    if (dto.number !== undefined) data.number = dto.number.trim();
    if (dto.subject !== undefined) data.subject = dto.subject.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.legalEntityId !== undefined) {
      await this.ensureRefs(current.contractorId, dto.legalEntityId);
      data.legalEntityId = dto.legalEntityId;
    }
    if (dto.signedAt !== undefined) data.signedAt = this.parseDate(dto.signedAt, 'Дата договора');
    if (dto.validUntil !== undefined) {
      const validUntil = dto.validUntil ? this.parseDate(dto.validUntil, 'Срок действия') : null;
      const signedAt = (data.signedAt as Date | undefined) ?? current.signedAt;
      if (validUntil && validUntil.getTime() < signedAt.getTime()) {
        throw new BadRequestException('Срок действия раньше даты договора');
      }
      data.validUntil = validUntil;
      // Срок продлили — предупреждение об истечении должно прийти заново.
      data.expiryNotifiedAt = null;
    }
    if (dto.terminatedAt !== undefined) {
      data.terminatedAt = dto.terminatedAt ? this.parseDate(dto.terminatedAt, 'Дата расторжения') : null;
    }

    const row = await this.prisma.contract.update({ where: { id }, data, include: contractInclude });
    return this.present(row);
  }

  async remove(id: string) {
    const current = await this.prisma.contract.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Договор не найден');
    const row = await this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: contractInclude,
    });
    return this.present(row);
  }

  /**
   * Статус и остаток дней не хранятся в базе, а считаются при чтении —
   * иначе «истёк» пришлось бы обновлять кроном и он мог бы отстать от реальности.
   * В базе status остаётся только как отметка расторжения.
   */
  private present(row: ContractRow) {
    const today = new Date();
    const status = resolveContractStatus(row, today);
    return {
      ...row,
      status,
      daysUntilExpiry: daysUntilExpiry(row, today),
      attachmentEntityType: AttachmentEntityType.CONTRACT,
    };
  }

  private async ensureRefs(contractorId: string, legalEntityId: string): Promise<void> {
    const [contractor, legalEntity] = await Promise.all([
      this.prisma.contractor.findFirst({ where: { id: contractorId, deletedAt: null }, select: { id: true } }),
      this.prisma.legalEntity.findFirst({ where: { id: legalEntityId, isActive: true }, select: { id: true } }),
    ]);
    if (!contractor) throw new BadRequestException('Контрагент не найден');
    if (!legalEntity) throw new BadRequestException('Активное юрлицо не найдено');
  }

  private parseDate(value: string, label: string): Date {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} указана неверно`);
    return date;
  }
}

export { ContractStatus };
