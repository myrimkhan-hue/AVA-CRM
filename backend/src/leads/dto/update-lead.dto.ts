import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLeadDto {
  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Укажите название лида' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string;

  @IsOptional()
  @IsString({ message: 'Город должен быть строкой' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'Контактное лицо должно быть строкой' })
  contactName?: string;

  @IsOptional()
  @IsString({ message: 'Email должен быть строкой' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Примечание должно быть строкой' })
  notes?: string;
}
