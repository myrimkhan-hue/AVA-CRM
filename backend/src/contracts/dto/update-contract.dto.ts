import { IsDateString, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Укажите номер договора' })
  @MaxLength(100, { message: 'Номер не длиннее 100 символов' })
  number?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Не указано юрлицо' })
  legalEntityId?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Дата договора указана неверно' })
  signedAt?: string;

  // null означает «сделать бессрочным», поэтому пустое значение допустимо.
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString({ strict: true }, { message: 'Срок действия указан неверно' })
  validUntil?: string | null;

  // null означает «снять расторжение».
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString({ strict: true }, { message: 'Дата расторжения указана неверно' })
  terminatedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Предмет договора не длиннее 300 символов' })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Примечание не длиннее 1000 символов' })
  notes?: string;
}
