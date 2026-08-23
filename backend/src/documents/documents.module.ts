import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DEFAULT_MAX_UPLOAD_MB } from '../attachments/attachment-rules';
import { DealsModule } from '../deals/deals.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ContractGeneratorService } from './contract-generator.service';
import { ContractsController } from './contracts.controller';
import { DocumentsController } from './documents.controller';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentPaymentTextsController } from './document-payment-texts.controller';
import { DocumentPaymentTextsService } from './document-payment-texts.service';
import { DocumentsService } from './documents.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesPdfController } from './invoices-pdf.controller';
import { RequestGeneratorService } from './request-generator.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [
    DealsModule,
    InvoicesModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: (Number(process.env.MAX_UPLOAD_MB) > 0
          ? Number(process.env.MAX_UPLOAD_MB)
          : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024,
        files: 1,
      },
      defParamCharset: 'utf8',
    }),
  ],
  controllers: [
    DocumentTemplatesController,
    DocumentPaymentTextsController,
    DocumentsController,
    ContractsController,
    RequestsController,
    InvoicesPdfController,
  ],
  providers: [
    DocumentsService,
    DocumentTemplatesService,
    DocumentPaymentTextsService,
    ContractGeneratorService,
    RequestGeneratorService,
    InvoicePdfService,
  ],
  exports: [DocumentsService, DocumentTemplatesService],
})
export class DocumentsModule {}
