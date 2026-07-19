import { IsOptional, IsString } from 'class-validator';

export class CreateDealDto {
  @IsString({ message: 'clientId должен быть строкой' })
  clientId!: string;

  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId!: string;

  @IsOptional()
  @IsString({ message: 'responsibleId должен быть строкой' })
  responsibleId?: string;

  @IsOptional()
  @IsString({ message: 'departmentId должен быть строкой' })
  departmentId?: string;

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;
}
