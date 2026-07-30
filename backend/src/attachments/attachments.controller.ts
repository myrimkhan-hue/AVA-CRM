import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AttachmentQueryDto } from './dto/attachment-query.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { AttachmentsService, UploadedFile as UploadedFileType } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /** Ограничения загрузки — чтобы интерфейс показывал их до выбора файла. */
  @Get('limits')
  limits() {
    return { maxUploadMb: this.attachmentsService.maxUploadMb };
  }

  @Get()
  list(@Query() query: AttachmentQueryDto, @CurrentUser() user: AuthUser) {
    return this.attachmentsService.list(query.entityType, query.entityId, user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: UploadedFileType | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attachmentsService.upload(dto.entityType, dto.entityId, file, dto.description, user);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const { buffer, fileName } = await this.attachmentsService.download(id, user);
    // Всегда attachment и нейтральный тип: файл скачивается, а не исполняется
    // в браузере — даже если внутри окажется что-то опасное.
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attachmentsService.remove(id, user);
  }
}
