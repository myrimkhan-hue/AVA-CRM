import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { NotificationType } from '@prisma/client';

class NotificationPreferenceItemDto {
  @IsEnum(NotificationType, { message: 'Указан неизвестный тип уведомления' })
  type!: NotificationType;

  @IsBoolean({ message: 'Признак включённости должен быть логическим значением' })
  enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray({ message: 'Настройки должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  items!: NotificationPreferenceItemDto[];
}
