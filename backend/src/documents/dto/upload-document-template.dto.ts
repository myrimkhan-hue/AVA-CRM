import { DocumentTemplateType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UploadDocumentTemplateDto {
  @IsEnum(DocumentTemplateType, { message: 'Указан неизвестный тип шаблона' })
  type!: DocumentTemplateType;

  @IsString({ message: 'Название шаблона должно быть строкой' })
  @MinLength(1, { message: 'Укажите название шаблона' })
  @Matches(/\S/u, { message: 'Укажите название шаблона' })
  @MaxLength(120, { message: 'Название шаблона не длиннее 120 символов' })
  displayName!: string;

  @IsOptional()
  @IsString({ message: 'Примечание должно быть строкой' })
  @MaxLength(500, { message: 'Примечание не длиннее 500 символов' })
  note?: string;
}
