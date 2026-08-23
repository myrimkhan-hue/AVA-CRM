import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentContactDto {
  @IsOptional()
  @IsString({ message: 'Имя для документов должно быть строкой' })
  documentName?: string | null;

  @IsOptional()
  @IsString({ message: 'Телефон для документов должен быть строкой' })
  documentPhone?: string | null;
}
