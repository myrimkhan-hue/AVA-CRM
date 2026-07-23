import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class InvoiceLineDto {
  @IsString({ message: 'Наименование услуги должно быть строкой' })
  @MinLength(1, { message: 'Укажите наименование услуги' })
  serviceName!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Количество должно быть числом с точностью до трёх знаков' },
  )
  @Min(0.001, { message: 'Количество должно быть больше нуля' })
  quantity!: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Цена должна быть числом с точностью до двух знаков' },
  )
  @Min(0, { message: 'Цена не может быть отрицательной' })
  unitPrice!: number;

  @IsBoolean({ message: 'Признак НДС должен быть логическим значением' })
  hasVat!: boolean;

  @ValidateIf((dto: InvoiceLineDto) => dto.hasVat)
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Ставка НДС должна быть числом с точностью до двух знаков' },
  )
  @Min(0, { message: 'Ставка НДС не может быть отрицательной' })
  @Max(100, { message: 'Ставка НДС не может превышать 100%' })
  vatRatePercent?: number;
}
