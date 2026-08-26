import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOperatingExpenseTypeDto {
  @IsString({ message: 'Название типа расхода должно быть строкой' })
  @MinLength(1, { message: 'Укажите название типа расхода' })
  @MaxLength(120, { message: 'Название типа расхода не должно быть длиннее 120 символов' })
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Порядок сортировки должен быть целым числом' })
  sortOrder?: number;

  @IsOptional()
  @IsBoolean({ message: 'Признак активности должен быть логическим значением' })
  isActive?: boolean;
}
