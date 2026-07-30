import { AttachmentEntityType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class AttachmentQueryDto {
  @IsEnum(AttachmentEntityType, { message: 'Неизвестный тип карточки' })
  entityType!: AttachmentEntityType;

  @IsString()
  @MinLength(1, { message: 'Не указана карточка' })
  entityId!: string;
}
