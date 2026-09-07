import { IsOptional, IsString } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

export class QuoteConversionQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsString()
  departmentId?: string;
}
