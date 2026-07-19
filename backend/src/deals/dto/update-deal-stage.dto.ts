import { DealRejectReason, DealStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDealStageDto {
  @IsEnum(DealStage, { message: 'Указана неизвестная стадия сделки' })
  stage!: DealStage;

  @IsOptional()
  @IsEnum(DealRejectReason, { message: 'Указана неизвестная причина отказа' })
  rejectReason?: DealRejectReason;

  @IsOptional()
  @IsString({ message: 'Комментарий к отказу должен быть строкой' })
  rejectComment?: string;
}
