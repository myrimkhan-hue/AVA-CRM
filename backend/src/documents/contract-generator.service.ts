import { Injectable } from '@nestjs/common';
import { GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { DealsService } from '../deals/deals.service';
import { TEMPLATE_PATHS } from './documents.constants';
import { DocumentsService, PartyInfo } from './documents.service';
import { PartyRequisitesOverrideDto } from './dto/party-requisites-override.dto';
import { safeName } from './lib/fill-docx';
import { buildContractNumberBase, formatDateRu } from './lib/format-date-ru';

@Injectable()
export class ContractGeneratorService {
  constructor(
    private readonly dealsService: DealsService,
    private readonly documentsService: DocumentsService,
  ) {}

  /** Договор с клиентом сделки — наше юрлицо всегда выступает исполнителем. */
  async generateForDeal(
    dealId: string,
    overrides: PartyRequisitesOverrideDto | undefined,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const deal = await this.dealsService.findOne(dealId, user);
    if (overrides) await this.documentsService.applyContractorOverrides(deal.clientId, overrides);

    const [legalEntity, client] = await Promise.all([
      this.documentsService.getLegalEntityParty(deal.legalEntityId),
      this.documentsService.getContractorParty(deal.clientId),
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
    overrides: PartyRequisitesOverrideDto | undefined,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (overrides) await this.documentsService.applyContractorOverrides(contractorId, overrides);

    const [legalEntity, contractor] = await Promise.all([
      this.documentsService.getLegalEntityParty(legalEntityId),
      this.documentsService.getContractorParty(contractorId),
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
    ourParty: PartyInfo & { numberingPrefix: string };
    otherParty: PartyInfo;
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
      contractorId: params.otherParty.id,
      legalEntityId: params.ourParty.id,
      userId: params.userId,
    });

    const filename = `Договор_${number.replace(/\//g, '-')}_${safeName(params.otherParty.name)}.docx`;
    return { buffer, filename };
  }
}
