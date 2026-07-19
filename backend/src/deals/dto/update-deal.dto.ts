import { IsOptional, IsString } from 'class-validator';

export class UpdateDealDto {
  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'responsibleId должен быть строкой' })
  responsibleId?: string;

  @IsOptional()
  @IsString({ message: 'departmentId должен быть строкой' })
  departmentId?: string;
}
