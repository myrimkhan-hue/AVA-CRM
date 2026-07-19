import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(1, { message: 'Введите пароль' })
  password!: string;
}
