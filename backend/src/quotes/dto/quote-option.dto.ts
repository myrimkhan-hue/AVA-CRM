import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateQuoteOptionDto {
  @IsOptional() @IsString() vehicleType?: string;
  @IsOptional() @IsString() carrierId?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costRate?: number;
  @IsOptional() @Matches(/^(KZT|USD)$/) costRateCurrency?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) clientRate?: number;
  @IsOptional() @Matches(/^(KZT|USD)$/) clientRateCurrency?: string;
  @IsOptional() @IsInt() @Min(1) transitDays?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateQuoteOptionDto extends CreateQuoteOptionDto {}
