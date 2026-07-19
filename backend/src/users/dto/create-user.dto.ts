import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'ФИО должно быть строкой' })
  @MinLength(1, { message: 'Укажите ФИО' })
  fullName!: string;

  @IsEmail({}, { message: 'Некорректный формат email' })
  email!: string;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Некорректный отдел' })
  departmentId?: string;

  @IsArray({ message: 'Роли должны быть массивом' })
  @ArrayNotEmpty({ message: 'Укажите хотя бы одну роль' })
  @IsString({ each: true, message: 'Код роли должен быть строкой' })
  roles!: string[];

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  password!: string;
}
