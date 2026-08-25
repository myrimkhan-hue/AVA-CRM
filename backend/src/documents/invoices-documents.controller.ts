import { Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoiceGeneratorService } from './invoice-generator.service';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('documents/invoices')
@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
export class InvoicesDocumentsController {
  constructor(private readonly invoiceGeneratorService: InvoiceGeneratorService) {}

  @Post(':invoiceId')
  async generate(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoiceGeneratorService.generate(invoiceId, user);
    res.setHeader('Content-Type', DOCX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }
}
