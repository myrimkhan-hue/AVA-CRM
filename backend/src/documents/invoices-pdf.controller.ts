import { Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvoicePdfService } from './invoice-pdf.service';

@Controller('documents/invoices')
@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
export class InvoicesPdfController {
  constructor(private readonly invoicePdfService: InvoicePdfService) {}

  @Post(':invoiceId')
  async generate(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoicePdfService.generate(invoiceId, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }
}
