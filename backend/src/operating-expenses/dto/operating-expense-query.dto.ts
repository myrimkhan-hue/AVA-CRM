import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class OperatingExpenseQueryDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Начало периода указано неверно' })
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Конец периода указан неверно' })
  dueDateTo?: string;

  @IsOptional()
  @IsString({ message: 'typeId должен быть строкой' })
  typeId?: string;

  @IsOptional()
  @IsString({ message: 'legalEntityId должен быть строкой' })
  legalEntityId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'Фильтр оплаты должен быть логическим значением' })
  paid?: boolean;
}
