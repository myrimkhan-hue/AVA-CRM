import { Transform, Type } from 'class-transformer';
import { DealStage } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QuoteQueryDto {
  @IsOptional() @IsEnum(DealStage) stage?: DealStage;
  @IsOptional() @IsString() responsibleId?: string;
  @IsOptional() @IsString() logistId?: string;
  /** Только свободные просчёты — те, где логист ещё не назначен. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
