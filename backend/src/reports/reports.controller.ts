import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CashCalendarQueryDto } from './dto/cash-calendar-query.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { sendXlsx } from './lib/send-xlsx';
import { ReportsExportService } from './reports-export.service';
import { ReportsService } from './reports.service';

@Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsExportService: ReportsExportService,
  ) {}

  @Get('dashboard')
  dashboard(@Query() query: DashboardQueryDto) {
    return this.reportsService.getDashboard(query);
  }

  @Get('dashboard/export')
  async exportDashboard(@Query() query: DashboardQueryDto, @Res() res: Response) {
    sendXlsx(res, await this.reportsExportService.exportDashboard(query));
  }

  @Get('receivables/export')
  async exportReceivables(@Res() res: Response) {
    sendXlsx(res, await this.reportsExportService.exportReceivables());
  }

  @Get('payables/export')
  async exportPayables(@Res() res: Response) {
    sendXlsx(res, await this.reportsExportService.exportPayables());
  }

  @Get('cash-calendar/export')
  async exportCashCalendar(@Query() query: CashCalendarQueryDto, @Res() res: Response) {
    sendXlsx(res, await this.reportsExportService.exportCashCalendar(query));
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
