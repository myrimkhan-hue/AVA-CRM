import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class ExchangeRateQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, {
    message: 'Код валюты должен состоять из трёх латинских букв',
  })
  currencyCode?: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата начала периода должна быть корректной датой' },
  )
  from?: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата окончания периода должна быть корректной датой' },
  )
  to?: string;
}
