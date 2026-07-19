import { Transform } from 'class-transformer';
import { TransportationStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class TransportationQueryDto {
  @IsOptional()
  @IsEnum(TransportationStatus, { message: 'Указан неизвестный статус перевозки' })
  status?: TransportationStatus;

  @IsOptional()
  @IsString({ message: 'dealId должен быть строкой' })
  dealId?: string;

  @IsOptional()
  @IsString({ message: 'logistId должен быть строкой' })
  logistId?: string;

  @IsOptional()
  @IsString({ message: 'Поисковая строка должна быть строкой' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'includeDeleted должен быть логическим значением' })
  includeDeleted?: boolean;
}
