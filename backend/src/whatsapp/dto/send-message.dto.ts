import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString({ message: 'Укажите контрагента' })
  @MinLength(1, { message: 'Укажите контрагента' })
  contractorId!: string;

  @IsString({ message: 'Текст сообщения должен быть строкой' })
  @MinLength(1, { message: 'Введите текст сообщения' })
  text!: string;

  @IsOptional()
  @IsString({ message: 'templateId должен быть строкой' })
  templateId?: string;
}
