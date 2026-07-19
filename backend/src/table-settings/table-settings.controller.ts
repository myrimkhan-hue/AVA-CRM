import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateTableSettingsDto } from './dto/update-table-settings.dto';
import { TableSettingsService } from './table-settings.service';

@Controller('me/table-settings')
export class TableSettingsController {
  constructor(private readonly tableSettingsService: TableSettingsService) {}

  @Get(':tableKey')
  findOne(@Param('tableKey') tableKey: string, @CurrentUser() user: AuthUser) {
    return this.tableSettingsService.findOne(user.id, tableKey);
  }

  @Put(':tableKey')
  upsert(
    @Param('tableKey') tableKey: string,
    @Body() dto: UpdateTableSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tableSettingsService.upsert(user.id, tableKey, dto);
  }
}
