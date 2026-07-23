import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';

@Module({
  controllers: [CurrenciesController, ExchangeRatesController],
  providers: [CurrenciesService, ExchangeRatesService],
  exports: [CurrenciesService, ExchangeRatesService],
})
export class CurrenciesModule {}
