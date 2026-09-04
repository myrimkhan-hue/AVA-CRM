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
} from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional() @IsString() originPoint?: string;
  @IsOptional() @IsString() destinationPoint?: string;
  @IsOptional() @IsString() cargoName?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) weightKg?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) volumeM3?: number;
  @IsOptional() @IsInt() @Min(1) placesCount?: number;
  @IsOptional() @IsString() placesUnit?: string;
  @IsOptional() @IsBoolean() isDangerous?: boolean;
  @IsOptional() @IsEnum(DeliveryTerms) deliveryTerms?: DeliveryTerms;
  @IsOptional() @IsDateString() cargoReadyDate?: string;
  @IsOptional() @IsEnum(TransportMode) transportMode?: TransportMode;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  clientTargetRate?: number;
  @IsOptional() @Matches(/^(KZT|USD)$/) clientTargetRateCurrency?: string;
  @IsOptional() @IsDateString() quoteRateDate?: string;
}
