import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '@prisma/client';

const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true;

export class LeadQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LeadStatus, { message: 'Указан неизвестный статус лида' })
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  responsibleId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Transform(toBoolean)
  unassigned?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  includeDeleted?: boolean;
}
