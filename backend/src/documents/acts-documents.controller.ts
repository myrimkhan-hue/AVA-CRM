import { Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActGeneratorService } from './act-generator.service';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('documents/acts')
@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
export class ActsDocumentsController {
  constructor(private readonly actGeneratorService: ActGeneratorService) {}

  @Post('invoice/:invoiceId')
  async generateForInvoice(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const result = await this.actGeneratorService.generateForInvoice(invoiceId, user);
    this.send(result, res);
  }

  @Post('deal/:dealId')
  async generateForDeal(
    @Param('dealId') dealId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const result = await this.actGeneratorService.generateForDeal(dealId, user);
    this.send(result, res);
  }

  private send(result: { buffer: Buffer; filename: string }, res: Response): void {
    res.setHeader('Content-Type', DOCX_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    res.send(result.buffer);
  }
}
