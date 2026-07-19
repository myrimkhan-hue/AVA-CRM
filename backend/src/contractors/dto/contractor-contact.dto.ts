import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ContractorContactDto {
  @IsString({ message: 'ФИО контактного лица должно быть строкой' })
  @MinLength(1, { message: 'Укажите ФИО контактного лица' })
  @Matches(/\S/, { message: 'Укажите ФИО контактного лица' })
  fullName!: string;

  @IsOptional()
  @IsString({ message: 'Должность должна быть строкой' })
  position?: string;

  @IsOptional()
  @IsString({ message: 'Телефон должен быть строкой' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный формат email контактного лица' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'WhatsApp должен быть строкой' })
  whatsapp?: string;
}
