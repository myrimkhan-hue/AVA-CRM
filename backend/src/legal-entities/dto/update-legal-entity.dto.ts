import { TaxRegime } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateLegalEntityDto {
  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Укажите название юрлица' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string | null;

  @IsOptional()
  @IsString({ message: 'Юридический адрес должен быть строкой' })
  legalAddress?: string | null;

  @IsOptional()
  @IsEnum(TaxRegime, { message: 'Выберите корректный налоговый режим' })
  taxRegime?: TaxRegime;

  @IsOptional()
  @IsBoolean({ message: 'Признак активности должен быть логическим значением' })
  isActive?: boolean;
}
