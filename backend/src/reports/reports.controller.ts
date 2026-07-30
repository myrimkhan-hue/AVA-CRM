import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CashCalendarQueryDto } from './dto/cash-calendar-query.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ReportsService } from './reports.service';

@Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reportsService.getDashboard(query);
  }

  @Get('receivables')
  receivables() {
    return this.reportsService.getReceivables();
  }

  @Get('payables')
  payables() {
    return this.reportsService.getPayables();
  }

  @Get('cash-calendar')
  cashCalendar(@Query() query: CashCalendarQueryDto) {
    return this.reportsService.getCashCalendar(query);
  }
}
