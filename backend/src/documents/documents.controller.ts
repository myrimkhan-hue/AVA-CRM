import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { GeneratedDocumentType } from '@prisma/client';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContractGeneratorService } from './contract-generator.service';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DocumentsService } from './documents.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { RequestGeneratorService } from './request-generator.service';

@Controller('documents')
@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST', 'FINANCIER')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly contractGeneratorService: ContractGeneratorService,
    private readonly requestGeneratorService: RequestGeneratorService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  findAll(@Query() query: DocumentQueryDto, @CurrentUser() user: AuthUser) {
    return this.documentsService.findAll(query, user);
  }

  @Post(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.findForDownload(id, user);
    let result: { buffer: Buffer; filename: string; contentType: string };

    switch (document.type) {
      case GeneratedDocumentType.CONTRACT: {
        const generated = document.dealId
          ? await this.contractGeneratorService.generateForDeal(
              document.dealId,
              undefined,
              user,
              document.number,
            )
          : await this.contractGeneratorService.generateForContractor(
              this.documentsService.requireContractorId(document.contractorId),
              this.documentsService.requireLegalEntityId(document.legalEntityId),
              undefined,
              user,
              document.number,
            );
        result = {
          ...generated,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        break;
      }
      case GeneratedDocumentType.TRANSPORT_REQUEST: {
        const generated = await this.requestGeneratorService.generateForLeg(
          this.documentsService.requireTransportationId(document.transportationId),
          this.documentsService.requireTransportationLegId(document.transportationLegId),
          this.documentsService.requestGenerationData(document.generationData),
          user,
          document.number,
        );
        result = {
          ...generated,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        break;
      }
      case GeneratedDocumentType.INVOICE: {
        const generated = await this.invoicePdfService.generate(
          this.documentsService.requireInvoiceId(document.invoiceId),
          user,
          document.number,
        );
        result = { ...generated, contentType: 'application/pdf' };
        break;
      }
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    res.send(result.buffer);
  }
}
