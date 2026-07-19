import { TransportationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateTransportationStatusDto {
  @IsEnum(TransportationStatus, { message: 'Указан неизвестный статус перевозки' })
  status!: TransportationStatus;

  @IsOptional()
  @IsDateString({}, { message: 'Дата события указана неверно' })
  eventDate?: string;
}
