import { GeneratedDocumentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class DocumentQueryDto {
  @IsOptional()
  @IsEnum(GeneratedDocumentType, { message: 'Указан неизвестный тип документа' })
  type?: GeneratedDocumentType;

  @IsOptional()
  @IsDateString({}, { message: 'Начальная дата указана неверно' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Конечная дата указана неверно' })
  dateTo?: string;

  @IsOptional()
  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId?: string;

  @IsOptional()
  @IsString({ message: 'contractorId должен быть строкой' })
  contractorId?: string;

  @IsOptional()
  @IsString({ message: 'dealId должен быть строкой' })
  dealId?: string;

  @IsOptional()
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId?: string;

  @IsOptional()
  @IsString({ message: 'generatedByUserId должен быть строкой' })
  generatedByUserId?: string;

  @IsOptional()
  @IsString({ message: 'Поисковый запрос должен быть строкой' })
  search?: string;
}
