import { Transform } from 'class-transformer';
import { ContractorType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ContractorQueryDto {
  @IsOptional()
  @IsString({ message: 'Поисковая строка должна быть строкой' })
  search?: string;

  @IsOptional()
  @IsEnum(ContractorType, { message: 'Указан неизвестный тип контрагента' })
  type?: ContractorType;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'includeDeleted должен быть логическим значением' })
  includeDeleted?: boolean;
}

export class DuplicateQueryDto {
  @IsOptional()
  @IsString({ message: 'БИН/ИИН должен быть строкой' })
  bin?: string;

  @IsOptional()
  @IsString({ message: 'Название должно быть строкой' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'excludeId должен быть строкой' })
  excludeId?: string;
}
