import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContractDto {
  @IsString()
  @MinLength(1, { message: 'Не указан контрагент' })
  contractorId!: string;

  @IsString()
  @MinLength(1, { message: 'Не указано юрлицо' })
  legalEntityId!: string;

  // Номер вводится вручную: бумажные договоры сохраняют свои номера (раздел 4.2 ТЗ).
  @IsString()
  @MinLength(1, { message: 'Укажите номер договора' })
  @MaxLength(100, { message: 'Номер не длиннее 100 символов' })
  number!: string;

  @IsDateString({ strict: true }, { message: 'Дата договора указана неверно' })
  signedAt!: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Срок действия указан неверно' })
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Предмет договора не длиннее 300 символов' })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Примечание не длиннее 1000 символов' })
  notes?: string;
}
