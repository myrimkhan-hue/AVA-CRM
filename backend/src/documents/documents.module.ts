import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ContractGeneratorService } from './contract-generator.service';
import { ContractsController } from './contracts.controller';
import { DocumentsService } from './documents.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesPdfController } from './invoices-pdf.controller';
import { RequestGeneratorService } from './request-generator.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [DealsModule, InvoicesModule],
  controllers: [ContractsController, RequestsController, InvoicesPdfController],
  providers: [DocumentsService, ContractGeneratorService, RequestGeneratorService, InvoicePdfService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
