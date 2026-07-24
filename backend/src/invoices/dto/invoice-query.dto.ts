import { Transform } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class InvoiceQueryDto {
  @IsOptional()
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId?: string;

  @IsOptional()
  @IsString({ message: 'clientId должен быть строкой' })
  clientId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus, { message: 'Указан неизвестный статус счёта' })
  status?: InvoiceStatus;

  @IsOptional()
  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'includeDeleted должен быть логическим значением' })
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'onlyIntragroup должен быть логическим значением' })
  onlyIntragroup?: boolean;
}
