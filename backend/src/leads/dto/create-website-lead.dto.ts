import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class WebsiteLeadUtmDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  campaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  term?: string;
}

/** Заявка с формы сайта ava-solution.kz (раздел 4.6.3 ТЗ). Подпись запроса проверяется в контроллере. */
export class CreateWebsiteLeadDto {
  @IsString()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  routeFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  routeTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cargoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  page?: string;

  @IsOptional()
  @IsIn(['ru', 'kz', 'zh'])
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebsiteLeadUtmDto)
  utm?: WebsiteLeadUtmDto;

  /** Honeypot: настоящие посетители это поле не видят и не заполняют — если оно не пустое, заявка от бота. */
  @IsOptional()
  @IsString()
  website?: string;
}
