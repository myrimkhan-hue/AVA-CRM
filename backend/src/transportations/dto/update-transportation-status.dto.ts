import { TransportationStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateTransportationStatusDto {
  @IsEnum(TransportationStatus, { message: 'Указан неизвестный статус перевозки' })
  status!: TransportationStatus;

  @IsOptional()
  @IsDateString({}, { message: 'Дата события указана неверно' })
  eventDate?: string;

  @IsOptional()
  @IsBoolean({ message: 'notifyWhatsapp должен быть булевым' })
  notifyWhatsapp?: boolean;

  @ValidateIf((dto: UpdateTransportationStatusDto) => Boolean(dto.notifyWhatsapp))
  @IsString({ message: 'Укажите шаблон сообщения' })
  whatsappTemplateId?: string;
}
