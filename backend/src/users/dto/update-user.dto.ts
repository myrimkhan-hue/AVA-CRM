import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'ФИО должно быть строкой' })
  @MinLength(1, { message: 'Укажите ФИО' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный формат email' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string | null;

  @IsOptional()
  @IsString({ message: 'Некорректный отдел' })
  departmentId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Роли должны быть массивом' })
  @ArrayNotEmpty({ message: 'Укажите хотя бы одну роль' })
  @IsString({ each: true, message: 'Код роли должен быть строкой' })
  roles?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ставка бонуса должна быть числом' })
  @Min(0, { message: 'Ставка бонуса не может быть отрицательной' })
  @Max(100, { message: 'Ставка бонуса не может быть больше 100%' })
  motivationRatePercent?: number | null;
}
