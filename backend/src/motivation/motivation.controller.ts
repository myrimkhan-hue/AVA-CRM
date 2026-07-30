import { Body, Controller, Get, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { sendXlsx } from '../reports/lib/send-xlsx';
import { MotivationReportQueryDto } from './dto/motivation-report-query.dto';
import { UpdateMotivationSettingsDto } from './dto/update-motivation-settings.dto';
import { MotivationService } from './motivation.service';

@Controller('motivation')
export class MotivationController {
  constructor(private readonly motivationService: MotivationService) {}

  @Get('settings')
  @Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
  getSettings() {
    return this.motivationService.getSettings();
  }

  @Patch('settings')
  @Roles('ADMIN', 'FINANCIER')
  updateSettings(@Body() dto: UpdateMotivationSettingsDto) {
    return this.motivationService.updateSettings(dto);
  }

  @Get('my-report')
  getMyReport(
    @Query() query: MotivationReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.motivationService.getMyReport(user, query.month);
  }

  @Get('report')
  getSummaryReport(
    @Query() query: MotivationReportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.motivationService.getSummaryReport(user, query.month);
  }

  @Get('report/export')
  async exportSummaryReport(
    @Query() query: MotivationReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    sendXlsx(res, await this.motivationService.exportSummaryReport(user, query.month));
  }
}
