import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePaymentRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Сумма должна быть числом с точностью до двух знаков' },
  )
  @Min(0.01, { message: 'Сумма должна быть больше нуля' })
  amount?: number;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Срок оплаты должен быть корректной датой' },
  )
  dueDate?: string;

  @IsOptional()
  @IsString({ message: 'Назначение платежа должно быть строкой' })
  @MinLength(1, { message: 'Укажите назначение платежа' })
  purpose?: string;
}
