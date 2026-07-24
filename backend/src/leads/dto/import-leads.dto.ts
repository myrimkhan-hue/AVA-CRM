import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class ImportLeadRowDto {
  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
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

export class ImportLeadsDto {
  @IsString({ message: 'Укажите имя файла' })
  @MinLength(1, { message: 'Укажите имя файла' })
  fileName!: string;

  @IsOptional()
  @IsString({ message: 'departmentId должен быть строкой' })
  departmentId?: string;

  @IsArray({ message: 'Строки должны быть массивом' })
  @ArrayNotEmpty({ message: 'Нет строк для импорта' })
  @ValidateNested({ each: true })
  @Type(() => ImportLeadRowDto)
  rows!: ImportLeadRowDto[];
}
