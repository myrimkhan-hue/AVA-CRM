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

  @IsOptional()
  @IsString({ message: 'Организационная форма должна быть строкой' })
  legalForm?: string | null;

  @IsOptional()
  @IsString({ message: 'Название банка должно быть строкой' })
  bankName?: string | null;

  @IsOptional()
  @IsString({ message: 'Расчётный счёт должен быть строкой' })
  bankAccount?: string | null;

  @IsOptional()
  @IsString({ message: 'БИК должен быть строкой' })
  bankBik?: string | null;

  @IsOptional()
  @IsString({ message: 'Должность подписанта должна быть строкой' })
  signerPosition?: string | null;

  @IsOptional()
  @IsString({ message: 'ФИО подписанта должно быть строкой' })
  signerFullName?: string | null;

  @IsOptional()
  @IsString({ message: 'Краткое ФИО подписанта должно быть строкой' })
  signerShortName?: string | null;

  @IsOptional()
  @IsString({ message: 'Основание подписания должно быть строкой' })
  signBasis?: string | null;

  @IsOptional()
  @IsString({ message: 'Номер талона должен быть строкой' })
  talonNumber?: string | null;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string | null;

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой' })
  email?: string | null;
}
