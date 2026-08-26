import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOperatingExpenseDto {
  @IsString({ message: 'typeId должен быть строкой' })
  typeId!: string;

  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId!: string;

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
    { message: 'Плановая дата платежа должна быть корректной датой' },
  )
  dueDate!: string;

  @IsString({ message: 'Назначение расхода должно быть строкой' })
  @MinLength(1, { message: 'Укажите назначение расхода' })
  @MaxLength(2000, { message: 'Назначение расхода не должно быть длиннее 2000 символов' })
  purpose!: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак ежемесячного расхода должен быть логическим значением' })
  isRecurringMonthly?: boolean;
}
