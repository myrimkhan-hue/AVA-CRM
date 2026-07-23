import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExchangeRateQueryDto } from './dto/exchange-rate-query.dto';
import { FetchNbrkDto } from './dto/fetch-nbrk.dto';
import { ManualExchangeRateDto } from './dto/manual-exchange-rate.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@Roles('ADMIN', 'FINANCIER')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get()
  findAll(@Query() query: ExchangeRateQueryDto) {
    return this.exchangeRatesService.findAll(query);
  }

  @Post()
  setManualRate(
    @Body() dto: ManualExchangeRateDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.exchangeRatesService.setManualRate(dto, actor.id);
  }

  @Post('fetch-nbrk')
  fetchNbrk(
    @Body() dto: FetchNbrkDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.exchangeRatesService.fetchNbrk(dto.date, actor.id);
  }
}
