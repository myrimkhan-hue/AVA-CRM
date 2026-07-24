import { Module } from '@nestjs/common';
import { CurrenciesModule } from '../currencies/currencies.module';
import { MarginService } from './margin.service';

@Module({
  imports: [CurrenciesModule],
  providers: [MarginService],
  exports: [MarginService],
})
export class MarginModule {}
