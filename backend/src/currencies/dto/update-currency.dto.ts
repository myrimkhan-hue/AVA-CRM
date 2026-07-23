import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCurrencyDto {
  @IsOptional()
  @IsString({ message: 'Название валюты должно быть строкой' })
  @MinLength(1, { message: 'Укажите название валюты' })
  name?: string;

  @IsOptional()
  @IsBoolean({ message: 'Признак активности должен быть логическим значением' })
  isActive?: boolean;
}
