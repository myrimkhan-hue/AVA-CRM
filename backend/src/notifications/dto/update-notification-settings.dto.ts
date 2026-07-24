import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @Type(() => Number)
  @IsInt({ message: 'Количество дней должно быть целым числом' })
  @Min(1, { message: 'Количество дней должно быть больше нуля' })
  dealStalledDays!: number;
}
