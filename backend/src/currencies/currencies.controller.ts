import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrenciesService } from './currencies.service';

@Roles('ADMIN', 'FINANCIER')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  findAll() {
    return this.currenciesService.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateCurrencyDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.currenciesService.create(dto, actor.id);
  }

  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.currenciesService.update(code, dto, actor.id);
  }
}
