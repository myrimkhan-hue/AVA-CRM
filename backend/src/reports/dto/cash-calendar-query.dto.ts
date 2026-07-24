import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class CashCalendarQueryDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Дата начала указана неверно' })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Дата окончания указана неверно' })
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week'], { message: 'Группировка может быть только "day" или "week"' })
  groupBy?: 'day' | 'week';
}
