import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';

export class CreateCurrencyDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Код валюты должен быть строкой' })
  @Matches(/^[A-Z]{3}$/, {
    message: 'Код валюты должен состоять из трёх латинских букв',
  })
  code!: string;

  @IsString({ message: 'Название валюты должно быть строкой' })
  @MinLength(1, { message: 'Укажите название валюты' })
  name!: string;
}
