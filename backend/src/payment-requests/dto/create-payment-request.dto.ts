import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePaymentRequestDto {
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId!: string;

  @IsOptional()
  @IsString({ message: 'legId должен быть строкой' })
  legId?: string;

  @IsString({ message: 'payeeContractorId должен быть строкой' })
  payeeContractorId!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Сумма должна быть числом с точностью до двух знаков' },
  )
  @Min(0.01, { message: 'Сумма должна быть больше нуля' })
  amount!: number;

  @IsString({ message: 'Код валюты должен быть строкой' })
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Код валюты должен состоять из трёх букв',
  })
  currencyCode!: string;

  @IsDateString(
    { strict: true },
    { message: 'Срок оплаты должен быть корректной датой' },
  )
  dueDate!: string;

  @IsString({ message: 'Назначение платежа должно быть строкой' })
  @MinLength(1, { message: 'Укажите назначение платежа' })
  purpose!: string;
}
