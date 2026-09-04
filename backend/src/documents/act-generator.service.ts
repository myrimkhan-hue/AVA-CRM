import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentTemplateType, GeneratedDocumentType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { DealsService } from '../deals/deals.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentTemplatesService } from './document-templates.service';
import {
  DocumentsService,
  LegalEntityPartyInfo,
  PartyInfo,
} from './documents.service';
import { amountToWordsWithTiyin, formatAmount } from './lib/amount-to-words';
import { DocxValues, safeName } from './lib/fill-docx';
import {
  buildActNumberBase,
  formatDateRu,
  formatDateShort,
} from './lib/format-date-ru';

const DASH = '—';

type InvoiceForAct = Awaited<ReturnType<InvoicesService['findOne']>>;

interface ActLine {
  serviceName: string;
  quantity: { toString(): string };
  unitPrice: Prisma.Decimal | string | number;
  totalAmount: Prisma.Decimal | string | number;
}

interface ActGenerationInput {
  date: Date;
  supplier: LegalEntityPartyInfo;
  buyer: PartyInfo;
  lines: ActLine[];
  currency: string;
  total: Prisma.Decimal;
  vat: Prisma.Decimal;
  invoiceId?: string;
  transportationId?: string;
  dealId?: string;
}

/**
 * Осознанный запасной вариант владельца: если разгрузка ещё не заполнена,
 * датой акта по счёту становится дата самого счёта.
 */
export function selectInvoiceActDate(
  unloadingEventDate: Date | null | undefined,
  issueDate: Date,
): Date {
  return unloadingEventDate ?? issueDate;
}

/**
 * Осознанный запасной вариант владельца: для сделки берём самую позднюю дату
 * разгрузки, а если таких дат нет ни у одной перевозки — текущую дату.
 */
export function selectDealActDate(
  unloadingEventDates: Array<Date | null | undefined>,
  currentDate: Date = new Date(),
): Date {
  const dates = unloadingEventDates.filter((value): value is Date => Boolean(value));
  return dates.reduce(
    (latest, value) => value.getTime() > latest.getTime() ? value : latest,
    dates[0] ?? currentDate,
  );
}

@Injectable()
export class ActGeneratorService {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly dealsService: DealsService,
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly documentTemplatesService: DocumentTemplatesService,
  ) {}

  async generateForInvoice(
    invoiceId: string,
    user: AuthUser,
    existingNumber?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoicesService.findOne(invoiceId, user);
    const date = selectInvoiceActDate(
      invoice.transportation.unloadingEventDate,
      invoice.issueDate,
    );
    const [supplier, buyer] = await Promise.all([
      this.documentsService.getLegalEntityParty(invoice.legalEntityId),
      this.documentsService.getContractorParty(invoice.clientId),
    ]);

    return this.generate({
      date,
      supplier,
      buyer,
      lines: invoice.lines,
      currency: invoice.currency.code,
      total: new Prisma.Decimal(invoice.totals.totalAmount),
      vat: new Prisma.Decimal(invoice.totals.vatAmount),
      invoiceId: invoice.id,
      transportationId: invoice.transportationId,
    }, user, existingNumber);
  }

  async generateForDeal(
    dealId: string,
    user: AuthUser,
    existingNumber?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const deal = await this.dealsService.findOne(dealId, user);
    const [invoices, totalInvoices] = await Promise.all([
      this.invoicesService.findForDeal(dealId, user),
      this.prisma.invoice.count({
        where: { deletedAt: null, transportation: { dealId } },
      }),
    ]);
    if (totalInvoices === 0) {
      throw new BadRequestException(
        'По сделке ещё нет счетов, акт формировать не из чего',
      );
    }
    // Видимость сделок и счетов настроена по-разному: руководитель отдела видит
    // сделку, где он ответственный, даже если она в чужом отделе, а счета по ней —
    // нет. Молча собрать акт из доступной части значит выдать клиенту документ с
    // недостающими строками и заниженной суммой, поэтому отказываем явно.
    if (invoices.length !== totalInvoices) {
      throw new BadRequestException(
        'Часть счетов этой сделки вам недоступна, поэтому сводный акт получился бы неполным. '
        + 'Попросите сформировать его администратора или финансиста.',
      );
    }

    const currencies = new Set(invoices.map((invoice) => invoice.currency.code));
    if (currencies.size > 1) {
      throw new BadRequestException(
        'Сводный акт по счетам в разных валютах сформировать нельзя',
      );
    }

    const transportationDates = await this.prisma.transportation.findMany({
      where: { dealId, isQuoteDraft: false, deletedAt: null },
      select: { unloadingEventDate: true },
    });
    const [supplier, buyer] = await Promise.all([
      this.documentsService.getLegalEntityParty(deal.legalEntityId),
      this.documentsService.getContractorParty(deal.clientId),
    ]);

    return this.generate({
      date: selectDealActDate(
        transportationDates.map((item) => item.unloadingEventDate),
      ),
      supplier,
      buyer,
      lines: invoices.flatMap((invoice) => invoice.lines),
      currency: invoices[0].currency.code,
      total: this.sumInvoiceTotal(invoices, 'totalAmount'),
      vat: this.sumInvoiceTotal(invoices, 'vatAmount'),
      dealId: deal.id,
    }, user, existingNumber);
  }

  private async generate(
    input: ActGenerationInput,
    user: AuthUser,
    existingNumber?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const [latestContract, number] = await Promise.all([
      this.documentsService.findLatestContract(input.buyer.id, input.supplier.id),
      existingNumber
        ? Promise.resolve(existingNumber)
        : this.documentsService.nextDocumentNumber(
            buildActNumberBase(input.supplier.numberingPrefix, input.date),
          ),
    ]);
    const contract = latestContract
      ? `№ ${latestContract.number} от ${formatDateShort(latestContract.generatedAt)}`
      : DASH;
    const total = Number(input.total);
    const vat = Number(input.vat);
    const totalWords = input.currency === 'KZT'
      ? `${formatAmount(total)} (${amountToWordsWithTiyin(total)})`
      : `${formatAmount(total)} ${input.currency}`;
    const values: DocxValues = {
      НОМЕР_АКТА: number,
      ДАТА_АКТА: formatDateRu(input.date),
      ...this.partyValues('ИСПОЛНИТЕЛЬ', input.supplier),
      ...this.partyValues('ЗАКАЗЧИК', input.buyer),
      ДОГОВОР: contract,
      ВАЛЮТА: input.currency,
      ИТОГО: formatAmount(total),
      НДС_СТРОКА: vat > 0
        ? `В том числе НДС: ${formatAmount(vat)} ${input.currency}`
        : 'Без НДС',
      КОЛИЧЕСТВО_НАИМЕНОВАНИЙ: input.lines.length,
      ВСЕГО_ПРОПИСЬЮ: totalWords,
    };
    const rows = {
      СТРОКА_УСЛУГИ: input.lines.map((line, index) => ({
        УСЛУГА_НОМЕР: index + 1,
        УСЛУГА_НАЗВАНИЕ: line.serviceName,
        УСЛУГА_КОЛИЧЕСТВО: line.quantity.toString(),
        УСЛУГА_ЕДИНИЦА: 'усл.',
        УСЛУГА_ЦЕНА: formatAmount(Number(line.unitPrice)),
        УСЛУГА_СУММА: formatAmount(Number(line.totalAmount)),
      })),
    };
    const buffer = await this.documentTemplatesService.fillTemplate(
      DocumentTemplateType.ACT,
      values,
      rows,
    );

    if (!existingNumber) {
      await this.documentsService.logGeneration({
        type: GeneratedDocumentType.ACT,
        number,
        invoiceId: input.invoiceId,
        transportationId: input.transportationId,
        dealId: input.dealId,
        contractorId: input.buyer.id,
        legalEntityId: input.supplier.id,
        userId: user.id,
      });
    }

    return {
      buffer,
      filename: `Акт_${number.replace(/\//g, '-')}_${safeName(input.buyer.name)}.docx`,
    };
  }

  private partyValues(prefix: 'ИСПОЛНИТЕЛЬ' | 'ЗАКАЗЧИК', party: PartyInfo): DocxValues {
    return {
      [`${prefix}_НАЗВАНИЕ`]: party.name,
      [`${prefix}_БИН`]: party.bin,
      [`${prefix}_АДРЕС`]: party.address,
      [`${prefix}_СЧЕТ`]: party.account,
      [`${prefix}_БАНК`]: party.bank,
      [`${prefix}_БИК`]: party.bik,
      [`${prefix}_ДОЛЖНОСТЬ`]: party.position,
      [`${prefix}_ПОДПИСАНТ`]: party.signerFull,
      [`${prefix}_ПОДПИСАНТ_КРАТКО`]: party.signerShort,
      [`${prefix}_ОСНОВАНИЕ`]: party.basis,
      [`${prefix}_ТЕЛЕФОН`]: party.phone,
      [`${prefix}_EMAIL`]: party.email,
    };
  }

  private sumInvoiceTotal(
    invoices: InvoiceForAct[],
    field: 'totalAmount' | 'vatAmount',
  ): Prisma.Decimal {
    return invoices.reduce(
      (sum, invoice) => sum.plus(invoice.totals[field]),
      new Prisma.Decimal(0),
    );
  }
}
