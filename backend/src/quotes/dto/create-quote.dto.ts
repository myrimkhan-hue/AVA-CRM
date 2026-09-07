import { DeliveryTerms, TransportMode } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateQuoteDto {
  @IsString() legalEntityId!: string;
  @IsOptional() @IsString() responsibleId?: string;
  @IsOptional() @IsString() @MinLength(1) logistId?: string | null;
  @IsOptional() @IsString() departmentId?: string;

  @ValidateIf((o: CreateQuoteDto) => !o.clientName)
  @IsString({ message: 'Укажите существующего клиента или название нового' })
  clientId?: string;

  @ValidateIf((o: CreateQuoteDto) => !o.clientId)
  @IsString({ message: 'Укажите существующего клиента или название нового' })
  @MinLength(1, { message: 'Название клиента не может быть пустым' })
  clientName?: string;

  @IsString() @MinLength(1) originPoint!: string;
  @IsString() @MinLength(1) destinationPoint!: string;
  @IsOptional() @IsString() cargoName?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) weightKg?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) volumeM3?: number;
  @IsOptional() @IsInt() @Min(1) placesCount?: number;
  @IsOptional() @IsString() placesUnit?: string;
  @IsOptional() @IsBoolean() isDangerous?: boolean;
  @IsOptional()
  @IsEnum(DeliveryTerms, { message: 'Указаны неизвестные условия поставки' })
  deliveryTerms?: DeliveryTerms;
  @IsOptional()
  @IsDateString({}, { message: 'Дата готовности груза указана неверно' })
  cargoReadyDate?: string;
  @IsEnum(TransportMode, { message: 'Указан неизвестный тип перевозки' })
  transportMode!: TransportMode;
  /** Тип ТС из заявки. Если указан, вместе с просчётом создаётся первый вариант расчёта с ним. */
  @IsOptional() @IsString() @MinLength(1) vehicleType?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  clientTargetRate?: number;
  @IsOptional()
  @Matches(/^(KZT|USD)$/, {
    message: 'Валюта просчёта должна быть KZT или USD',
  })
  clientTargetRateCurrency?: string;
  @IsOptional()
  @IsDateString({}, { message: 'Дата фиксации курса указана неверно' })
  quoteRateDate?: string;
}
