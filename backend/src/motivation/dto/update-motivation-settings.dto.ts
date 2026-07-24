import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateMotivationSettingsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ставка бонуса должна быть числом' })
  @Min(0, { message: 'Ставка бонуса не может быть отрицательной' })
  @Max(100, { message: 'Ставка бонуса не может быть больше 100%' })
  bonusRatePercent!: number;
}
