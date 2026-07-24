import { IsOptional, Matches } from 'class-validator';

export class MotivationReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Месяц должен быть в формате YYYY-MM' })
  month?: string;
}
