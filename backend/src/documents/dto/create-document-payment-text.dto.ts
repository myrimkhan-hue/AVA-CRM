import { DocumentPaymentTextType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateDocumentPaymentTextDto {
  @IsEnum(DocumentPaymentTextType, { message: 'Указан неизвестный вид формулировки' })
  type!: DocumentPaymentTextType;

  @IsString({ message: 'Короткое название должно быть строкой' })
  @Matches(/\S/u, { message: 'Укажите короткое название' })
  shortName!: string;

  @IsString({ message: 'Формулировка должна быть строкой' })
  @Matches(/\S/u, { message: 'Укажите текст формулировки' })
  text!: string;

  @IsOptional()
  @IsInt({ message: 'Порядок сортировки должен быть целым числом' })
  sortOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'Некорректный признак значения по умолчанию' })
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Некорректный признак активности' })
  isActive?: boolean;
}
