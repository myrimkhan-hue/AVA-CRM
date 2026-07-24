import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GeneratedDocumentType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { DealsService } from '../deals/deals.service';
import { PrismaService } from '../prisma/prisma.service';
import { TEMPLATE_PATHS } from './documents.constants';
import { DocumentsService } from './documents.service';
import { ContractorRequisitesOverrideDto } from './dto/generate-contract.dto';
import { buildContractNumberBase, formatDateRu } from './lib/format-date-ru';
import { safeName } from './lib/fill-docx';

interface ContractParty {
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
  phone: string;
  email: string;
}

const DASH = '—';

@Injectable()
export class ContractGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
    private readonly documentsService: DocumentsService,
  ) {}

  /** Договор с клиентом сделки — наше юрлицо всегда выступает исполнителем. */
  async generateForDeal(
    dealId: string,
    overrides: ContractorRequisitesOverrideDto | undefined,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const deal = await this.dealsService.findOne(dealId, user);
    if (overrides) await this.applyContractorOverrides(deal.clientId, overrides);

    const [legalEntity, client] = await Promise.all([
      this.getLegalEntity(deal.legalEntityId),
      this.getContractor(deal.clientId),
    ]);

    return this.build({
      ourRole: 'executor',
      ourParty: legalEntity,
      otherParty: client,
      dealId,
      userId: user.id,
    });
  }

  /** Договор с перевозчиком/поставщиком — наше юрлицо всегда выступает заказчиком. */
  async generateForContractor(
    contractorId: string,
    legalEntityId: string,
    overrides: ContractorRequisitesOverrideDto | undefined,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (overrides) await this.applyContractorOverrides(contractorId, overrides);

    const [legalEntity, contractor] = await Promise.all([
      this.getLegalEntity(legalEntityId),
      this.getContractor(contractorId),
    ]);

    return this.build({
      ourRole: 'customer',
      ourParty: legalEntity,
      otherParty: contractor,
      userId: user.id,
    });
  }

  private async build(params: {
    ourRole: 'customer' | 'executor';
    ourParty: ContractParty & { id: string; numberingPrefix: string };
    otherParty: ContractParty & { id: string };
    dealId?: string;
    userId: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const customer = params.ourRole === 'customer' ? params.ourParty : params.otherParty;
    const executor = params.ourRole === 'executor' ? params.ourParty : params.otherParty;

    const today = new Date();
    const baseNumber = buildContractNumberBase(params.ourParty.numberingPrefix, params.ourRole, today);
    const number = await this.documentsService.nextDocumentNumber(baseNumber);
    const dateStr = formatDateRu(today);

    const buffer = await this.documentsService.fillTemplate(TEMPLATE_PATHS.CONTRACT, {
      НОМЕР_ДОГОВОРА: number,
      ДАТА_ДОГОВОРА: dateStr,
      ЗАКАЗЧИК_НАЗВАНИЕ: customer.name,
      ЗАКАЗЧИК_БИН: customer.bin,
      ЗАКАЗЧИК_АДРЕС: customer.address,
      ЗАКАЗЧИК_СЧЕТ: customer.account,
      ЗАКАЗЧИК_БАНК: customer.bank,
      ЗАКАЗЧИК_БИК: customer.bik,
      ЗАКАЗЧИК_ДОЛЖНОСТЬ: customer.position,
      ЗАКАЗЧИК_ПОДПИСАНТ: customer.signerFull,
      ЗАКАЗЧИК_ПОДПИСАНТ_КРАТКО: customer.signerShort,
      ЗАКАЗЧИК_ОСНОВАНИЕ: customer.basis,
      ЗАКАЗЧИК_ТЕЛЕФОН: customer.phone,
      ЗАКАЗЧИК_EMAIL: customer.email,
      ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: executor.name,
      ИСПОЛНИТЕЛЬ_БИН: executor.bin,
      ИСПОЛНИТЕЛЬ_АДРЕС: executor.address,
      ИСПОЛНИТЕЛЬ_СЧЕТ: executor.account,
      ИСПОЛНИТЕЛЬ_БАНК: executor.bank,
      ИСПОЛНИТЕЛЬ_БИК: executor.bik,
      ИСПОЛНИТЕЛЬ_ДОЛЖНОСТЬ: executor.position,
      ИСПОЛНИТЕЛЬ_ПОДПИСАНТ: executor.signerFull,
      ИСПОЛНИТЕЛЬ_ПОДПИСАНТ_КРАТКО: executor.signerShort,
      ИСПОЛНИТЕЛЬ_ОСНОВАНИЕ: executor.basis,
      ИСПОЛНИТЕЛЬ_ТЕЛЕФОН: executor.phone,
      ИСПОЛНИТЕЛЬ_EMAIL: executor.email,
    });

    await this.documentsService.logGeneration({
      type: GeneratedDocumentType.CONTRACT,
      number,
      dealId: params.dealId,
      userId: params.userId,
    });

    const filename = `Договор_${number.replace(/\//g, '-')}_${safeName(params.otherParty.name)}.docx`;
    return { buffer, filename };
  }

  private async applyContractorOverrides(
    contractorId: string,
    overrides: ContractorRequisitesOverrideDto,
  ): Promise<void> {
    const data: Prisma.ContractorUpdateInput = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      (data as Record<string, unknown>)[key] = value.trim() || null;
    }
    if (Object.keys(data).length === 0) return;
    await this.prisma.contractor.update({ where: { id: contractorId }, data });
  }

  private async getLegalEntity(id: string) {
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
      phone: legalEntity.phone ?? DASH,
      email: legalEntity.email ?? DASH,
    };
  }

  private async getContractor(id: string) {
    const contractor = await this.prisma.contractor.findFirst({ where: { id, deletedAt: null } });
    if (!contractor) throw new BadRequestException('Контрагент не найден');
    return {
      id: contractor.id,
      name: contractor.name,
      bin: contractor.bin ?? DASH,
      address: contractor.legalAddress ?? DASH,
      account: contractor.bankAccount ?? DASH,
      bank: contractor.bankName ?? DASH,
      bik: contractor.bankBik ?? DASH,
      position: contractor.signerPosition ?? DASH,
      signerFull: contractor.signerFullName ?? DASH,
      signerShort: contractor.signerShortName ?? DASH,
      basis: contractor.signBasis ?? DASH,
      phone: contractor.phone ?? DASH,
      email: contractor.email ?? DASH,
    };
  }
}
