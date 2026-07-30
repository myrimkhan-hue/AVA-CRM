import { ContractStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ContractQueryDto {
  @IsOptional()
  @IsString()
  contractorId?: string;

  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @IsOptional()
  @IsEnum(ContractStatus, { message: 'Неизвестный статус договора' })
  status?: ContractStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
