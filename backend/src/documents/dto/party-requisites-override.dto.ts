import { IsOptional, IsString } from 'class-validator';

export class PartyRequisitesOverrideDto {
  @IsOptional() @IsString({ message: 'Организационная форма должна быть строкой' })
  legalForm?: string;

  @IsOptional() @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string;

  @IsOptional() @IsString({ message: 'Адрес должен быть строкой' })
  legalAddress?: string;

  @IsOptional() @IsString({ message: 'Банк должен быть строкой' })
  bankName?: string;

  @IsOptional() @IsString({ message: 'Счёт должен быть строкой' })
  bankAccount?: string;

  @IsOptional() @IsString({ message: 'БИК должен быть строкой' })
  bankBik?: string;

  @IsOptional() @IsString({ message: 'Должность подписанта должна быть строкой' })
  signerPosition?: string;

  @IsOptional() @IsString({ message: 'ФИО подписанта должно быть строкой' })
  signerFullName?: string;

  @IsOptional() @IsString({ message: 'Краткое ФИО подписанта должно быть строкой' })
  signerShortName?: string;

  @IsOptional() @IsString({ message: 'Основание подписания должно быть строкой' })
  signBasis?: string;

  @IsOptional() @IsString({ message: 'Номер талона должен быть строкой' })
  talonNumber?: string;

  @IsOptional() @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string;

  @IsOptional() @IsString({ message: 'Email должен быть строкой' })
  email?: string;
}
