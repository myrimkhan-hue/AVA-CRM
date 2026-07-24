import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ContractorBankAccountDto {
  @IsString({ message: 'Название банка должно быть строкой' })
  @MinLength(1, { message: 'Укажите название банка' })
  @Matches(/\S/, { message: 'Укажите название банка' })
  bankName!: string;

  @IsString({ message: 'Номер счёта должен быть строкой' })
  @MinLength(1, { message: 'Укажите номер счёта' })
  @Matches(/\S/, { message: 'Укажите номер счёта' })
  accountNumber!: string;

  @IsString({ message: 'Валюта должна быть строкой' })
  @MinLength(1, { message: 'Укажите код валюты' })
  @Matches(/\S/, { message: 'Укажите код валюты' })
  currency!: string;

  @IsOptional()
  @IsString({ message: 'БИК должен быть строкой' })
  bik?: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак «для документов» должен быть логическим значением' })
  isPrimary?: boolean;

  @IsOptional()
  @IsString({ message: 'Примечание к счёту должно быть строкой' })
  notes?: string;
}
