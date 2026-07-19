import { Transform } from 'class-transformer';
import { DealStage } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class DealQueryDto {
  @IsOptional()
  @IsEnum(DealStage, { message: 'Указана неизвестная стадия сделки' })
  stage?: DealStage;

  @IsOptional()
  @IsString({ message: 'clientId должен быть строкой' })
  clientId?: string;

  @IsOptional()
  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId?: string;

  @IsOptional()
  @IsString({ message: 'responsibleId должен быть строкой' })
  responsibleId?: string;

  @IsOptional()
  @IsString({ message: 'Поисковая строка должна быть строкой' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'includeDeleted должен быть логическим значением' })
  includeDeleted?: boolean;
}
