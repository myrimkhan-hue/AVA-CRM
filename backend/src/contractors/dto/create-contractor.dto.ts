import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ContractorType, PaymentTerm } from '@prisma/client';
import { ContractorBankAccountDto } from './contractor-bank-account.dto';
import { ContractorContactDto } from './contractor-contact.dto';

export class CreateContractorDto {
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Укажите название контрагента' })
  name!: string;

  @IsArray({ message: 'Типы должны быть массивом' })
  @ArrayNotEmpty({ message: 'Укажите хотя бы один тип контрагента' })
  @IsEnum(ContractorType, { each: true, message: 'Указан неизвестный тип контрагента' })
  types!: ContractorType[];

  @IsOptional()
  @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string;

  @IsOptional()
  @IsString({ message: 'Страна должна быть строкой' })
  country?: string;

  @IsOptional()
  @IsString({ message: 'Юридический адрес должен быть строкой' })
  legalAddress?: string;

  @IsOptional()
  @IsEnum(PaymentTerm, { message: 'Указано неизвестное условие оплаты' })
  paymentTerm?: PaymentTerm;

  @ValidateIf((dto: CreateContractorDto) => dto.paymentTerm === PaymentTerm.POSTPAYMENT)
  @IsInt({ message: 'Количество дней постоплаты должно быть целым числом' })
  @Min(1, { message: 'Количество дней постоплаты должно быть больше нуля' })
  postpaymentDays?: number;

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак проблемного контрагента должен быть логическим значением' })
  isProblem?: boolean;

  @IsOptional()
  @IsString({ message: 'Комментарий о проблеме должен быть строкой' })
  problemComment?: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак чёрного списка должен быть логическим значением' })
  isBlacklisted?: boolean;

  @ValidateIf((dto: CreateContractorDto) => dto.isBlacklisted === true)
  @IsString({ message: 'Причина чёрного списка должна быть строкой' })
  @MinLength(1, { message: 'Укажите причину добавления в чёрный список' })
  blacklistReason?: string;

  @IsOptional()
  @IsArray({ message: 'Контакты должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => ContractorContactDto)
  contacts?: ContractorContactDto[];

  @IsOptional()
  @IsArray({ message: 'Банковские счета должны быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => ContractorBankAccountDto)
  bankAccounts?: ContractorBankAccountDto[];

  @IsOptional()
  @IsString({ message: 'Организационная форма должна быть строкой' })
  legalForm?: string;

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
