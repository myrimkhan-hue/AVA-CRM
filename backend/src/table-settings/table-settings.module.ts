import { Module } from '@nestjs/common';
import { TableSettingsController } from './table-settings.controller';
import { TableSettingsService } from './table-settings.service';

@Module({
  controllers: [TableSettingsController],
  providers: [TableSettingsService],
})
export class TableSettingsModule {}
