import { Injectable } from '@nestjs/common';
import { DocumentTemplateType, GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { InvoicesService } from '../invoices/invoices.service';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentsService } from './documents.service';
import { amountToWordsWithTiyin, formatAmount } from './lib/amount-to-words';
import { DocxValues, safeName } from './lib/fill-docx';
import { formatDateRu, formatDateShort } from './lib/format-date-ru';

const DASH = '—';

@Injectable()
export class InvoiceGeneratorService {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly documentsService: DocumentsService,
    private readonly documentTemplatesService: DocumentTemplatesService,
  ) {}

  async generate(
    invoiceId: string,
    user: AuthUser,
    existingNumber?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoicesService.findOne(invoiceId, user);
    const [supplier, buyer, latestContract] = await Promise.all([
      this.documentsService.getLegalEntityParty(invoice.legalEntityId),
      this.documentsService.getContractorParty(invoice.clientId),
      this.documentsService.findLatestContract(invoice.clientId, invoice.legalEntityId),
    ]);

    const number = existingNumber ?? invoice.number;
    const currency = invoice.currency.code;
    const total = Number(invoice.totals.totalAmount);
    const vat = Number(invoice.totals.vatAmount);
    const totalWords = currency === 'KZT'
      ? `${formatAmount(total)} (${amountToWordsWithTiyin(total)})`
      : `${formatAmount(total)} ${currency}`;
    const contract = latestContract
      ? `№ ${latestContract.number} от ${formatDateShort(latestContract.generatedAt)}`
      : DASH;

    const values: DocxValues = {
      НОМЕР_СЧЕТА: number,
      ДАТА_СЧЕТА: formatDateRu(new Date(invoice.issueDate)),
      ПОСТАВЩИК_НАЗВАНИЕ: supplier.name,
      ПОСТАВЩИК_БИН: supplier.bin,
      ПОСТАВЩИК_СЧЕТ: supplier.account,
      ПОСТАВЩИК_БАНК: supplier.bank,
      ПОСТАВЩИК_БИК: supplier.bik,
      ПОСТАВЩИК_КБЕ: supplier.kbe,
      ПОСТАВЩИК_КНП: supplier.paymentPurposeCode,
      ПОСТАВЩИК_АДРЕС: supplier.address,
      ПОКУПАТЕЛЬ_НАЗВАНИЕ: buyer.name,
      ПОКУПАТЕЛЬ_БИН: buyer.bin,
      ПОКУПАТЕЛЬ_АДРЕС: buyer.address,
      ПОКУПАТЕЛЬ_ТЕЛЕФОН: buyer.phone,
      ДОГОВОР: contract,
      ВАЛЮТА: currency,
      ИТОГО: formatAmount(total),
      НДС_СТРОКА: vat > 0
        ? `В том числе НДС: ${formatAmount(vat)} ${currency}`
        : 'Без НДС',
      КОЛИЧЕСТВО_НАИМЕНОВАНИЙ: invoice.lines.length,
      ВСЕГО_К_ОПЛАТЕ_ПРОПИСЬЮ: totalWords,
      ПОСТАВЩИК_ПОДПИСАНТ_КРАТКО: supplier.signerShort,
    };
    const rows = {
      СТРОКА_УСЛУГИ: invoice.lines.map((line, index) => ({
        УСЛУГА_НОМЕР: index + 1,
        УСЛУГА_НАЗВАНИЕ: line.serviceName,
        УСЛУГА_КОЛИЧЕСТВО: line.quantity.toString(),
        УСЛУГА_ЕДИНИЦА: 'усл.',
        УСЛУГА_ЦЕНА: formatAmount(Number(line.unitPrice)),
        УСЛУГА_СУММА: formatAmount(Number(line.totalAmount)),
      })),
    };
    const buffer = await this.documentTemplatesService.fillTemplate(
      DocumentTemplateType.INVOICE,
      values,
      rows,
    );

    if (!existingNumber) {
      await this.documentsService.logGeneration({
        type: GeneratedDocumentType.INVOICE,
        number,
        invoiceId: invoice.id,
        transportationId: invoice.transportationId,
        contractorId: invoice.clientId,
        legalEntityId: invoice.legalEntityId,
        userId: user.id,
      });
    }

    const filename = `Счёт_${number.replace(/\//g, '-')}_${safeName(buyer.name)}.docx`;
    return { buffer, filename };
  }
}
