import { AttachmentEntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadAttachmentDto {
  @IsEnum(AttachmentEntityType, { message: 'Неизвестный тип карточки' })
  entityType!: AttachmentEntityType;

  @IsString()
  @MinLength(1, { message: 'Не указана карточка' })
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Описание не длиннее 300 символов' })
  description?: string;
}
