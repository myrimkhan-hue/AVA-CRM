import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DEFAULT_MAX_UPLOAD_MB } from './attachment-rules';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB) > 0
  ? Number(process.env.MAX_UPLOAD_MB)
  : DEFAULT_MAX_UPLOAD_MB;

@Module({
  imports: [
    MulterModule.register({
      // Файл держим в памяти и пишем на диск сами — так имя на диске задаём мы,
      // а не клиент. Лимит дублируется здесь, чтобы слишком большой файл
      // обрывался ещё на приёме, не доходя до сервиса.
      storage: memoryStorage(),
      limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
      // Без этого multer читает имя файла как latin1, и любое русское название
      // («Договор №5.pdf») превращается в нечитаемый мусор.
      defParamCharset: 'utf8',
    }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
