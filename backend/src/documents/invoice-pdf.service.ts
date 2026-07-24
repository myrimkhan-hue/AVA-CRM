import { Injectable } from '@nestjs/common';
import { GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { InvoicesService } from '../invoices/invoices.service';
import { DocumentsService } from './documents.service';
import { buildInvoiceHtml } from './invoice-html';
import { safeName } from './lib/fill-docx';
import { htmlToPdf } from './lib/html-to-pdf';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly documentsService: DocumentsService,
  ) {}

  async generate(invoiceId: string, user: AuthUser): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.invoicesService.findOne(invoiceId, user);

    const [issuer, buyer, latestContract] = await Promise.all([
      this.documentsService.getLegalEntityParty(invoice.legalEntityId),
      this.documentsService.getContractorParty(invoice.clientId),
      this.documentsService.findLatestContract(invoice.clientId, invoice.legalEntityId),
    ]);

    const html = buildInvoiceHtml({
      number: invoice.number,
      issueDate: new Date(invoice.issueDate),
      currencyCode: invoice.currency.code,
      issuer,
      buyer,
      contractNumber: latestContract?.number ?? null,
      contractDate: latestContract?.generatedAt ?? null,
      lines: invoice.lines.map((line) => ({
        serviceName: line.serviceName,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        totalAmount: line.totalAmount.toString(),
      })),
      netAmount: invoice.totals.netAmount.toString(),
      vatAmount: invoice.totals.vatAmount.toString(),
      totalAmount: invoice.totals.totalAmount.toString(),
    });

    const buffer = await htmlToPdf(html);

    await this.documentsService.logGeneration({
      type: GeneratedDocumentType.INVOICE,
      number: invoice.number,
      transportationId: invoice.transportationId,
      contractorId: invoice.clientId,
      legalEntityId: invoice.legalEntityId,
      userId: user.id,
    });

    const filename = `Счёт_${invoice.number.replace(/\//g, '-')}_${safeName(buyer.name)}.pdf`;
    return { buffer, filename };
  }
}
