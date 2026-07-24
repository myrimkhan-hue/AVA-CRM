import { Module } from '@nestjs/common';
import { CurrenciesModule } from '../currencies/currencies.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [CurrenciesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
