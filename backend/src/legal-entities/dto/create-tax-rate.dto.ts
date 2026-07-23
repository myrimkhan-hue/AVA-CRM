import { TaxRateKind } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTaxRateDto {
  @IsEnum(TaxRateKind, { message: 'Выберите корректный вид налоговой ставки' })
  kind!: TaxRateKind;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Ставка должна быть числом с точностью не более двух знаков' },
  )
  @Min(0, { message: 'Ставка не может быть отрицательной' })
  @Max(100, { message: 'Ставка не может превышать 100%' })
  ratePercent!: number;

  @ValidateIf((dto: CreateTaxRateDto) => dto.kind === TaxRateKind.VAT)
  @IsBoolean({ message: 'Укажите, является ли юрлицо плательщиком НДС' })
  isVatPayer?: boolean;

  @IsDateString(
    { strict: true },
    { message: 'Дата начала действия должна быть корректной датой' },
  )
  effectiveFrom!: string;

  @IsOptional()
  @IsString({ message: 'Комментарий должен быть строкой' })
  note?: string;
}
