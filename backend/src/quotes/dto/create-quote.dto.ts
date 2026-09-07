import { DeliveryTerms, TransportMode } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MaxLength,
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

  // trim до проверки: иначе маршрут из одних пробелов проходит MinLength(1)
  // и в базу попадает просчёт с пустым направлением.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Укажите пункт отправления' })
  @MaxLength(200, { message: 'Пункт отправления не длиннее 200 символов' })
  originPoint!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Укажите пункт назначения' })
  @MaxLength(200, { message: 'Пункт назначения не длиннее 200 символов' })
  destinationPoint!: string;
  @IsOptional() @IsString() @MaxLength(500, { message: 'Наименование груза не длиннее 500 символов' }) cargoName?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(99999999, { message: 'Вес указан неправдоподобно большим' }) weightKg?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(99999999, { message: 'Объём указан неправдоподобно большим' }) volumeM3?: number;
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
  @Max(999999999999, { message: 'Сумма указана неправдоподобно большой' })
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
