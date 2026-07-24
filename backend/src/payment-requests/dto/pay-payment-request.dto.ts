import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class PayPaymentRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'Фактический курс должен быть числом с точностью до шести знаков' },
  )
  @Min(0.000001, { message: 'Фактический курс должен быть больше нуля' })
  actualExchangeRate?: number;
}
