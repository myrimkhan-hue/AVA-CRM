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

  @IsOptional()
  @IsString({ message: 'Организационная форма должна быть строкой' })
  legalForm?: string;

  @IsOptional()
  @IsString({ message: 'Название банка должно быть строкой' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'Расчётный счёт должен быть строкой' })
  bankAccount?: string;

  @IsOptional()
  @IsString({ message: 'БИК должен быть строкой' })
  bankBik?: string;

  @IsOptional()
  @IsString({ message: 'Должность подписанта должна быть строкой' })
  signerPosition?: string;

  @IsOptional()
  @IsString({ message: 'ФИО подписанта должно быть строкой' })
  signerFullName?: string;

  @IsOptional()
  @IsString({ message: 'Краткое ФИО подписанта должно быть строкой' })
  signerShortName?: string;

  @IsOptional()
  @IsString({ message: 'Основание подписания должно быть строкой' })
  signBasis?: string;

  @IsOptional()
  @IsString({ message: 'Номер талона должен быть строкой' })
  talonNumber?: string;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой' })
  email?: string;
}
