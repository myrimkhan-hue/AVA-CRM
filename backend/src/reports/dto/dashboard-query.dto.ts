import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Дата начала указана неверно' })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Дата окончания указана неверно' })
  to?: string;
}
