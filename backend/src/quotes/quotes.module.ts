import { Module } from '@nestjs/common';
import { CurrenciesModule } from '../currencies/currencies.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [CurrenciesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
