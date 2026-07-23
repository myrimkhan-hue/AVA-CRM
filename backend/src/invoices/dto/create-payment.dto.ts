import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsDateString(
    { strict: true },
    { message: 'Дата оплаты должна быть корректной датой' },
  )
  paymentDate!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Сумма оплаты должна быть числом с точностью до двух знаков' },
  )
  @Min(0.01, { message: 'Сумма оплаты должна быть больше нуля' })
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'Фактический курс должен быть числом с точностью до шести знаков' },
  )
  @Min(0.000001, { message: 'Фактический курс должен быть больше нуля' })
  manualExchangeRate?: number;

  @IsOptional()
  @IsString({ message: 'Комментарий должен быть строкой' })
  note?: string;
}
