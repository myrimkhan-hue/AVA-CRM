import { Module } from '@nestjs/common';
import { CurrenciesModule } from '../currencies/currencies.module';
import { MarginModule } from '../deals/margin.module';
import { ReportsController } from './reports.controller';
import { ReportsExportService } from './reports-export.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [CurrenciesModule, MarginModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
})
export class ReportsModule {}
