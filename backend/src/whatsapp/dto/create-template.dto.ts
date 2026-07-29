import { IsString, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString({ message: 'Название должно быть строкой' })
  @MinLength(1, { message: 'Укажите название шаблона' })
  title!: string;

  @IsString({ message: 'Текст должен быть строкой' })
  @MinLength(1, { message: 'Укажите текст шаблона' })
  body!: string;
}
