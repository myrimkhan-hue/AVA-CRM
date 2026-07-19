import { Type } from 'class-transformer';
import { TransportMode } from '@prisma/client';
import {
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { InitialTransportationLegDto } from './transportation-leg.dto';

export class CreateTransportationDto {
  @IsString({ message: 'dealId должен быть строкой' })
  dealId!: string;

  @IsOptional()
  @IsString({ message: 'logistId должен быть строкой' })
  logistId?: string;

  @IsOptional()
  @IsString({ message: 'Наименование груза должно быть строкой' })
  cargoName?: string;

  @IsOptional()
  @IsInt({ message: 'Количество мест должно быть целым числом' })
  @Min(1, { message: 'Количество мест должно быть больше нуля' })
  placesCount?: number;

  @IsOptional()
  @IsString({ message: 'Единица упаковки должна быть строкой' })
  placesUnit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Вес должен быть числом' })
  @Min(0, { message: 'Вес не может быть отрицательным' })
  weightKg?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Объём должен быть числом' })
  @Min(0, { message: 'Объём не может быть отрицательным' })
  volumeM3?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Стоимость груза должна быть числом' })
  @Min(0, { message: 'Стоимость груза не может быть отрицательной' })
  cargoValue?: number;

  @IsOptional()
  @IsString({ message: 'Валюта стоимости груза должна быть строкой' })
  @Matches(/^[A-Za-z]{3}$/, { message: 'Валюта стоимости груза должна состоять из трёх букв' })
  cargoValueCurrency?: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак опасного груза должен быть логическим значением' })
  isDangerous?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Признак температурного режима должен быть логическим значением' })
  isTempControlled?: boolean;

  @IsString({ message: 'Пункт отправления должен быть строкой' })
  @MinLength(1, { message: 'Укажите пункт отправления' })
  originPoint!: string;

  @IsString({ message: 'Пункт назначения должен быть строкой' })
  @MinLength(1, { message: 'Укажите пункт назначения' })
  destinationPoint!: string;

  @IsEnum(TransportMode, { message: 'Указан неизвестный вид транспорта' })
  transportMode!: TransportMode;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ставка клиента должна быть числом' })
  @Min(0, { message: 'Ставка клиента не может быть отрицательной' })
  clientRate?: number;

  @IsOptional()
  @IsString({ message: 'Валюта ставки клиента должна быть строкой' })
  @Matches(/^[A-Za-z]{3}$/, { message: 'Валюта ставки клиента должна состоять из трёх букв' })
  clientRateCurrency?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Плановая дата доставки указана неверно' })
  plannedDeliveryDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Фактическая дата забора указана неверно' })
  pickupEventDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Фактическая дата доставки указана неверно' })
  actualDeliveryDate?: string;

  @IsOptional()
  @IsOptional()
  @IsString({ message: 'Грузоотправитель должен быть строкой' })
  shipperName?: string;

  @IsOptional()
  @IsOptional()
  @IsString({ message: 'Грузополучатель должен быть строкой' })
  consigneeName?: string;

  @IsOptional()
  @IsString({ message: 'Адрес погрузки должен быть строкой' })
  loadingAddress?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Дата и время погрузки указаны неверно' })
  loadingDateTime?: string;

  @IsOptional()
  @IsString({ message: 'Имя контакта на погрузке должно быть строкой' })
  loadingContactName?: string;

  @IsOptional()
  @IsString({ message: 'Телефон контакта на погрузке должен быть строкой' })
  loadingContactPhone?: string;

  @IsOptional()
  @IsString({ message: 'Адрес выгрузки должен быть строкой' })
  unloadingAddress?: string;

  @IsOptional()
  @IsString({ message: 'Имя контакта на выгрузке должно быть строкой' })
  unloadingContactName?: string;

  @IsOptional()
  @IsString({ message: 'Телефон контакта на выгрузке должен быть строкой' })
  unloadingContactPhone?: string;

  @IsOptional()
  @IsString({ message: 'Тип кузова должен быть строкой' })
  bodyType?: string;

  @IsOptional()
  @IsArray({ message: 'Сопроводительные документы должны быть массивом' })
  @IsString({ each: true, message: 'Название сопроводительного документа должно быть строкой' })
  accompanyingDocs?: string[];

  @IsOptional()
  @IsString({ message: 'Особые условия должны быть строкой' })
  specialConditions?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InitialTransportationLegDto)
  initialLeg?: InitialTransportationLegDto;
}
