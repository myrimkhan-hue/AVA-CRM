import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentTemplateType } from '@prisma/client';
import type { Response } from 'express';
import { UploadedFile as UploadedFileType } from '../attachments/attachments.service';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentTemplatesService } from './document-templates.service';
import { UploadDocumentTemplateDto } from './dto/upload-document-template.dto';

@Controller('document-templates')
@Roles('ADMIN')
export class DocumentTemplatesController {
  constructor(private readonly documentTemplatesService: DocumentTemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.documentTemplatesService.list(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Body() dto: UploadDocumentTemplateDto,
    @UploadedFile() file: UploadedFileType | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentTemplatesService.upload(dto, file, user);
  }

  @Get('fallback/:type/download')
  async downloadFallback(
    @Param('type', new ParseEnumPipe(DocumentTemplateType)) type: DocumentTemplateType,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const result = await this.documentTemplatesService.downloadFallback(type, user);
    this.sendFile(res, result.buffer, result.fileName);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const result = await this.documentTemplatesService.download(id, user);
    this.sendFile(res, result.buffer, result.fileName);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentTemplatesService.activate(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.documentTemplatesService.remove(id, user);
  }

  private sendFile(res: Response, buffer: Buffer, fileName: string): void {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.send(buffer);
  }
}
