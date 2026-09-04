import { DealRejectReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class LoseQuoteDto {
  @IsEnum(DealRejectReason, { message: 'Укажите корректную причину отказа' })
  rejectReason!: DealRejectReason;

  @IsOptional() @IsString() rejectComment?: string;
}
