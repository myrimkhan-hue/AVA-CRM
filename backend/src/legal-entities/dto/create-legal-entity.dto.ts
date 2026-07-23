import { TaxRegime } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateLegalEntityDto {
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Укажите название юрлица' })
  name!: string;

  @IsString({ message: 'Префикс нумерации должен быть строкой' })
  @MinLength(1, { message: 'Укажите префикс нумерации' })
  numberingPrefix!: string;

  @IsOptional()
  @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string;

  @IsOptional()
  @IsString({ message: 'Юридический адрес должен быть строкой' })
  legalAddress?: string;

  @IsEnum(TaxRegime, { message: 'Выберите корректный налоговый режим' })
  taxRegime!: TaxRegime;
}
