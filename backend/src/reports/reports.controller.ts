import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CashCalendarQueryDto } from './dto/cash-calendar-query.dto';
import { ReportsService } from './reports.service';

@Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
