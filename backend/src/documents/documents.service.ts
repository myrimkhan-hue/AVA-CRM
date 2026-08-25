import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GeneratedDocumentType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { generatedDocumentVisibilityWhere } from './document-policy';
import { DocumentQueryDto } from './dto/document-query.dto';
import { GenerateTransportRequestDto } from './dto/generate-transport-request.dto';

const DASH = '—';

export interface PartyInfo {
  id: string;
  name: string;
  bin: string;
  address: string;
  account: string;
  bank: string;
  bik: string;
  position: string;
  signerFull: string;
  signerShort: string;
  basis: string;
  talon: string;
  phone: string;
  email: string;
}

export interface LegalEntityPartyInfo extends PartyInfo {
  numberingPrefix: string;
  kbe: string;
  paymentPurposeCode: string;
}

export interface PartyRequisitesOverride {
  legalForm?: string;
  bin?: string;
  legalAddress?: string;
  bankName?: string;
  bankAccount?: string;
  bankBik?: string;
  signerPosition?: string;
  signerFullName?: string;
  signerShortName?: string;
  signBasis?: string;
  talonNumber?: string;
  phone?: string;
  email?: string;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Уникальный номер документа на базе ключа (обычно уже содержит дату,
   * например "TT-EX-2407/2026"). Первый документ с таким ключом получает
   * номер как есть, второй за тот же день — суффикс "/2" и так далее.
   */
  async nextDocumentNumber(baseKey: string): Promise<string> {
    const counter = await this.prisma.documentNumberCounter.upsert({
      where: { key: baseKey },
      create: { key: baseKey, count: 1 },
      update: { count: { increment: 1 } },
    });
    return counter.count <= 1 ? baseKey : `${baseKey}/${counter.count}`;
  }

  async logGeneration(params: {
    type: GeneratedDocumentType;
    number: string;
    dealId?: string;
    transportationId?: string;
    transportationLegId?: string;
    invoiceId?: string;
    contractorId?: string;
    legalEntityId?: string;
    generationData?: Prisma.InputJsonValue;
    userId: string;
  }) {
    return this.prisma.generatedDocument.create({
      data: {
        type: params.type,
        number: params.number,
        dealId: params.dealId,
        transportationId: params.transportationId,
        transportationLegId: params.transportationLegId,
        invoiceId: params.invoiceId,
        contractorId: params.contractorId,
        legalEntityId: params.legalEntityId,
        generationData: params.generationData,
        generatedByUserId: params.userId,
      },
    });
  }

  async findAll(query: DocumentQueryDto, user: AuthUser) {
    const generatedAt = this.generatedAtFilter(query.dateFrom, query.dateTo);
    const documents = await this.prisma.generatedDocument.findMany({
      where: {
        AND: [
          generatedDocumentVisibilityWhere(user),
          {
            type: query.type,
            generatedAt,
            legalEntityId: query.legalEntityId,
            contractorId: query.contractorId,
            dealId: query.dealId,
            transportationId: query.transportationId,
            generatedByUserId: query.generatedByUserId,
            number: query.search?.trim()
              ? { contains: query.search.trim(), mode: 'insensitive' }
              : undefined,
          },
        ],
      },
      include: {
        generatedBy: { select: { id: true, fullName: true } },
        legalEntity: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        deal: { select: { id: true, number: true } },
        transportation: { select: { id: true, number: true } },
        invoice: { select: { id: true, number: true, transportationId: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return documents.map((document) => ({
      id: document.id,
      type: document.type,
      number: document.number,
      generatedAt: document.generatedAt,
      generatedBy: document.generatedBy,
      legalEntity: document.legalEntity,
      contractor: document.contractor,
      source: this.sourceResponse(document),
    }));
  }

  async findForDownload(id: string, user: AuthUser) {
    const document = await this.prisma.generatedDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Запись журнала документов не найдена');

    this.assertDownloadRole(document.type, Boolean(document.dealId), user);
    await this.assertSourceAvailable(document);

    if (!user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role))) {
      const visible = await this.prisma.generatedDocument.findFirst({
        where: { AND: [{ id }, generatedDocumentVisibilityWhere(user)] },
        select: { id: true },
      });
      if (!visible) throw new ForbiddenException('Нет доступа к карточке-источнику документа');
    }

    return document;
  }

  requireContractorId(value: string | null): string {
    if (!value) {
      throw new BadRequestException('В записи журнала не сохранён контрагент договора');
    }
    return value;
  }

  requireLegalEntityId(value: string | null): string {
    if (!value) {
      throw new BadRequestException('В записи журнала не сохранено юрлицо документа');
    }
    return value;
  }

  requireTransportationId(value: string | null): string {
    if (!value) {
      throw new BadRequestException('В записи журнала не сохранена перевозка документа');
    }
    return value;
  }

  requireTransportationLegId(value: string | null): string {
    if (!value) {
      throw new BadRequestException(
        'Для этой записи журнала не сохранён участок перевозки — скачайте заявку из карточки перевозки',
      );
    }
    return value;
  }

  requireInvoiceId(value: string | null): string {
    if (!value) {
      throw new BadRequestException(
        'Для этой записи журнала не сохранена ссылка на счёт — скачайте счёт из карточки перевозки',
      );
    }
    return value;
  }

  requireDealId(value: string | null): string {
    if (!value) {
      throw new BadRequestException(
        'Для этой записи журнала не сохранена ссылка на сделку — скачайте акт из карточки сделки',
      );
    }
    return value;
  }

  requestGenerationData(value: Prisma.JsonValue | null): GenerateTransportRequestDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const data = value as Record<string, Prisma.JsonValue>;
    return {
      paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : undefined,
      paymentConditions:
        typeof data.paymentConditions === 'string' ? data.paymentConditions : undefined,
      documents: typeof data.documents === 'string' ? data.documents : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    };
  }

  private sourceResponse(document: {
    type: GeneratedDocumentType;
    number: string;
    dealId: string | null;
    transportationId: string | null;
    invoiceId: string | null;
    deal: { id: string; number: string } | null;
    transportation: { id: string; number: string } | null;
    invoice: { id: string; number: string; transportationId: string } | null;
  }) {
    if (document.type === GeneratedDocumentType.CONTRACT && document.dealId) {
      return {
        type: 'DEAL' as const,
        id: document.dealId,
        number: document.deal?.number ?? null,
      };
    }
    if (
      document.type === GeneratedDocumentType.TRANSPORT_REQUEST
      && document.transportationId
    ) {
      return {
        type: 'TRANSPORTATION' as const,
        id: document.transportationId,
        number: document.transportation?.number ?? null,
      };
    }
    if (document.type === GeneratedDocumentType.INVOICE && document.invoiceId) {
      return {
        type: 'INVOICE' as const,
        id: document.invoiceId,
        number: document.invoice?.number ?? document.number,
        transportationId: document.invoice?.transportationId ?? document.transportationId,
      };
    }
    if (document.type === GeneratedDocumentType.ACT && document.invoiceId) {
      return {
        type: 'INVOICE' as const,
        id: document.invoiceId,
        number: document.invoice?.number ?? null,
        transportationId: document.invoice?.transportationId ?? document.transportationId,
      };
    }
    if (document.type === GeneratedDocumentType.ACT && document.dealId) {
      return {
        type: 'DEAL' as const,
        id: document.dealId,
        number: document.deal?.number ?? null,
      };
    }
    return null;
  }

  private generatedAtFilter(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    return {
      gte: dateFrom ? this.dateBoundary(dateFrom, false) : undefined,
      lte: dateTo ? this.dateBoundary(dateTo, true) : undefined,
    };
  }

  private dateBoundary(value: string, endOfDay: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    }
    return new Date(value);
  }

  private assertDownloadRole(
    type: GeneratedDocumentType,
    hasDealSource: boolean,
    user: AuthUser,
  ): void {
    const rolesByType: Record<GeneratedDocumentType, string[]> = {
      [GeneratedDocumentType.CONTRACT]: hasDealSource
        ? ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER']
        : ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST'],
      [GeneratedDocumentType.TRANSPORT_REQUEST]: [
        'ADMIN',
        'DIRECTOR',
        'DEPARTMENT_HEAD',
        'MANAGER',
        'LOGIST',
      ],
      [GeneratedDocumentType.INVOICE]: [
        'ADMIN',
        'DIRECTOR',
        'DEPARTMENT_HEAD',
        'MANAGER',
        'FINANCIER',
      ],
      [GeneratedDocumentType.ACT]: [
        'ADMIN',
        'DIRECTOR',
        'DEPARTMENT_HEAD',
        'MANAGER',
        'FINANCIER',
      ],
    };
    if (!user.roles.some((role) => rolesByType[type].includes(role))) {
      throw new ForbiddenException('Недостаточно прав для повторного скачивания документа');
    }
  }

  private async assertSourceAvailable(document: {
    type: GeneratedDocumentType;
    dealId: string | null;
    transportationId: string | null;
    invoiceId: string | null;
    contractorId: string | null;
  }): Promise<void> {
    let source: { deletedAt: Date | null } | null = null;
    if (document.type === GeneratedDocumentType.CONTRACT && document.dealId) {
      source = await this.prisma.deal.findUnique({
        where: { id: document.dealId },
        select: { deletedAt: true },
      });
    } else if (
      document.type === GeneratedDocumentType.TRANSPORT_REQUEST
      && document.transportationId
    ) {
      const transportation = await this.prisma.transportation.findUnique({
        where: { id: document.transportationId },
        select: { deletedAt: true, deal: { select: { deletedAt: true } } },
      });
      source = transportation && !transportation.deal.deletedAt ? transportation : null;
    } else if (document.type === GeneratedDocumentType.INVOICE && document.invoiceId) {
      source = await this.prisma.invoice.findUnique({
        where: { id: document.invoiceId },
        select: { deletedAt: true },
      });
    } else if (document.type === GeneratedDocumentType.ACT && document.invoiceId) {
      source = await this.prisma.invoice.findUnique({
        where: { id: document.invoiceId },
        select: { deletedAt: true },
      });
    } else if (document.type === GeneratedDocumentType.ACT && document.dealId) {
      source = await this.prisma.deal.findUnique({
        where: { id: document.dealId },
        select: { deletedAt: true },
      });
    } else if (document.type === GeneratedDocumentType.CONTRACT && document.contractorId) {
      source = await this.prisma.contractor.findUnique({
        where: { id: document.contractorId },
        select: { deletedAt: true },
      });
    }

    if (source?.deletedAt || (!source && this.hasExpectedSource(document))) {
      throw new BadRequestException(
        'Карточка-источник документа удалена — повторное скачивание невозможно',
      );
    }
  }

  private hasExpectedSource(document: {
    type: GeneratedDocumentType;
    dealId: string | null;
    transportationId: string | null;
    invoiceId: string | null;
    contractorId: string | null;
  }): boolean {
    if (document.type === GeneratedDocumentType.CONTRACT) {
      return Boolean(document.dealId || document.contractorId);
    }
    if (document.type === GeneratedDocumentType.TRANSPORT_REQUEST) {
      return Boolean(document.transportationId);
    }
    if (document.type === GeneratedDocumentType.ACT) {
      return Boolean(document.invoiceId || document.dealId);
    }
    return Boolean(document.invoiceId);
  }

  /** Последний сгенерированный договор с этим контрагентом от этого юрлица (для заголовка заявки — "Приложение к договору"). */
  async findLatestContract(contractorId: string, legalEntityId: string) {
    return this.prisma.generatedDocument.findFirst({
      where: {
        type: GeneratedDocumentType.CONTRACT,
        contractorId,
        legalEntityId,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async getLegalEntityParty(id: string): Promise<LegalEntityPartyInfo> {
    const legalEntity = await this.prisma.legalEntity.findUnique({ where: { id } });
    if (!legalEntity) throw new NotFoundException('Юрлицо не найдено');
    return {
      id: legalEntity.id,
      numberingPrefix: legalEntity.numberingPrefix,
      name: legalEntity.name,
      bin: legalEntity.bin ?? DASH,
      address: legalEntity.legalAddress ?? DASH,
      account: legalEntity.bankAccount ?? DASH,
      bank: legalEntity.bankName ?? DASH,
      bik: legalEntity.bankBik ?? DASH,
      kbe: legalEntity.kbe ?? DASH,
      paymentPurposeCode: legalEntity.paymentPurposeCode ?? DASH,
      position: legalEntity.signerPosition ?? DASH,
      signerFull: legalEntity.signerFullName ?? DASH,
      signerShort: legalEntity.signerShortName ?? DASH,
      basis: legalEntity.signBasis ?? DASH,
      talon: legalEntity.talonNumber ?? DASH,
      phone: legalEntity.phone ?? DASH,
      email: legalEntity.email ?? DASH,
    };
  }

  async getContractorParty(id: string): Promise<PartyInfo> {
    const contractor = await this.prisma.contractor.findFirst({
      where: { id, deletedAt: null },
      include: { bankAccounts: true },
    });
    if (!contractor) throw new BadRequestException('Контрагент не найден');
    const bankAccount = contractor.bankAccounts.find((item) => item.isPrimary) ?? contractor.bankAccounts[0];
    return {
      id: contractor.id,
      name: contractor.name,
      bin: contractor.bin ?? DASH,
      address: contractor.legalAddress ?? DASH,
      account: bankAccount?.accountNumber ?? DASH,
      bank: bankAccount?.bankName ?? DASH,
      bik: bankAccount?.bik ?? DASH,
      position: contractor.signerPosition ?? DASH,
      signerFull: contractor.signerFullName ?? DASH,
      signerShort: contractor.signerShortName ?? DASH,
      basis: contractor.signBasis ?? DASH,
      talon: contractor.talonNumber ?? DASH,
      phone: contractor.phone ?? DASH,
      email: contractor.email ?? DASH,
    };
  }

  /**
   * Реквизиты подписанта и юр. данные пишутся прямо в контрагента; банковские
   * (bankName/bankAccount/bankBik) — в отдельный счёт из "Банковские счета"
   * с пометкой isPrimary, чтобы не дублировать поля с карточкой контрагента
   * (см. решение владельца от 2026-07-24).
   */
  async applyContractorOverrides(
    contractorId: string,
    overrides: PartyRequisitesOverride,
  ): Promise<void> {
    const { bankName, bankAccount, bankBik, ...scalarOverrides } = overrides;
    const data: Prisma.ContractorUpdateInput = {};
    for (const [key, value] of Object.entries(scalarOverrides)) {
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] = value.trim() || null;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.contractor.update({ where: { id: contractorId }, data });
      }
      if (bankName === undefined && bankAccount === undefined && bankBik === undefined) return;

      const primary = await tx.contractorBankAccount.findFirst({
        where: { contractorId, isPrimary: true },
      });
      if (primary) {
        await tx.contractorBankAccount.update({
          where: { id: primary.id },
          data: {
            bankName: bankName !== undefined ? bankName.trim() || primary.bankName : undefined,
            accountNumber: bankAccount !== undefined ? bankAccount.trim() || primary.accountNumber : undefined,
            bik: bankBik !== undefined ? bankBik.trim() || null : undefined,
          },
        });
      } else if (bankName?.trim() && bankAccount?.trim()) {
        await tx.contractorBankAccount.create({
          data: {
            contractorId,
            bankName: bankName.trim(),
            accountNumber: bankAccount.trim(),
            currency: 'KZT',
            bik: bankBik?.trim() || null,
            isPrimary: true,
          },
        });
      }
    });
  }
}
