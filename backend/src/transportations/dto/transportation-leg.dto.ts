import { PartialType } from '@nestjs/mapped-types';
import { LegStatus, LegTransportMode, VatMode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransportationLegDto {
  @IsString({ message: 'Пункт отправления участка должен быть строкой' })
  @MinLength(1, { message: 'Укажите пункт отправления участка' })
  fromPoint!: string;

  @IsString({ message: 'Пункт назначения участка должен быть строкой' })
  @MinLength(1, { message: 'Укажите пункт назначения участка' })
  toPoint!: string;

  @IsEnum(LegTransportMode, { message: 'Указан неизвестный вид транспорта участка' })
  mode!: LegTransportMode;

  @IsOptional()
  @IsString({ message: 'subcontractorId должен быть строкой' })
  subcontractorId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ставка субподрядчика должна быть числом' })
  @Min(0, { message: 'Ставка субподрядчика не может быть отрицательной' })
  subcontractorRate?: number;

  @IsOptional()
  @IsString({ message: 'Валюта ставки субподрядчика должна быть строкой' })
  @Matches(/^[A-Za-z]{3}$/, { message: 'Валюта ставки субподрядчика должна состоять из трёх букв' })
  subcontractorRateCurrency?: string;

  @IsOptional()
  @IsEnum(VatMode, { message: 'Указан неизвестный режим НДС' })
  vatMode?: VatMode;

  @IsOptional()
  @IsDateString({}, { message: 'Плановая дата забора указана неверно' })
  plannedStartDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Плановая дата доставки участка указана неверно' })
  plannedEndDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Фактическая дата забора указана неверно' })
  actualStartDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Фактическая дата доставки участка указана неверно' })
  actualEndDate?: string;

  @IsOptional()
  @IsString({ message: 'Номер машины должен быть строкой' })
  vehicleNumber?: string;

  @IsOptional()
  @IsString({ message: 'Номер прицепа должен быть строкой' })
  trailerNumber?: string;

  @IsOptional()
  @IsEnum(LegStatus, { message: 'Указан неизвестный статус участка' })
  status?: LegStatus;

  @IsOptional()
  @IsString({ message: 'ФИО водителя должно быть строкой' })
  driverFullName?: string;

  @IsOptional()
  @IsString({ message: 'Телефон водителя должен быть строкой' })
  driverPhone?: string;

  @IsOptional()
  @IsString({ message: 'ИИН водителя должен быть строкой' })
  driverIin?: string;

  @IsOptional()
  @IsString({ message: 'Номер водительского удостоверения должен быть строкой' })
  driverLicenseNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Дата выдачи водительского удостоверения указана неверно' })
  driverLicenseDate?: string;

  @IsOptional()
  @IsString({ message: 'Поле «Кем выдано» должно быть строкой' })
  driverLicenseIssuer?: string;
}

export class InitialTransportationLegDto extends PartialType(CreateTransportationLegDto) {}

export class UpdateTransportationLegDto extends PartialType(CreateTransportationLegDto) {}
