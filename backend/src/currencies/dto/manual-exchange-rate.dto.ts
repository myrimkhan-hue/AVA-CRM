import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  Matches,
  Min,
} from 'class-validator';

export class ManualExchangeRateDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, {
    message: 'Код валюты должен состоять из трёх латинских букв',
  })
  currencyCode!: string;

  @IsDateString(
    { strict: true },
    { message: 'Дата курса должна быть корректной датой' },
  )
  rateDate!: string;

  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'Курс должен быть числом с точностью не более шести знаков' },
  )
  @Min(0.000001, { message: 'Курс должен быть больше нуля' })
  rate!: number;
}
