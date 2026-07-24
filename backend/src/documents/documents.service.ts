import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GeneratedDocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocxValues, fillDocx } from './lib/fill-docx';

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

  async fillTemplate(templatePath: string, values: DocxValues): Promise<Buffer> {
    return fillDocx(templatePath, values);
  }

  async logGeneration(params: {
    type: GeneratedDocumentType;
    number: string;
    dealId?: string;
    transportationId?: string;
    contractorId?: string;
    legalEntityId?: string;
    userId: string;
  }) {
    return this.prisma.generatedDocument.create({
      data: {
        type: params.type,
        number: params.number,
        dealId: params.dealId,
        transportationId: params.transportationId,
        contractorId: params.contractorId,
        legalEntityId: params.legalEntityId,
        generatedByUserId: params.userId,
      },
    });
  }

  async history(params: { dealId?: string; transportationId?: string }) {
    return this.prisma.generatedDocument.findMany({
      where: {
        dealId: params.dealId,
        transportationId: params.transportationId,
      },
      include: { generatedBy: { select: { id: true, fullName: true } } },
      orderBy: { generatedAt: 'desc' },
    });
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

  async getLegalEntityParty(id: string): Promise<PartyInfo & { numberingPrefix: string }> {
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
