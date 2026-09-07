import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { LoseQuoteDto } from './dto/lose-quote.dto';
import {
  CreateQuoteOptionDto,
  UpdateQuoteOptionDto,
} from './dto/quote-option.dto';
import { QuoteQueryDto } from './dto/quote-query.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { WinQuoteDto } from './dto/win-quote.dto';
import { QuotesService } from './quotes.service';

const MANAGER_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'DEPARTMENT_HEAD',
  'MANAGER',
] as const;
const OPTION_ROLES = [...MANAGER_ROLES, 'LOGIST'] as const;

@Controller('quotes')
export class QuotesController {
  constructor(private readonly service: QuotesService) {}
  @Post()
  @Roles(...MANAGER_ROLES)
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }
  @Get()
  findAll(@Query() query: QuoteQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }
  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }
  @Post(':id/options')
  @Roles(...OPTION_ROLES)
  addOption(
    @Param('id') id: string,
    @Body() dto: CreateQuoteOptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addOption(id, dto, user);
  }
  @Patch(':id/options/:optionId')
  @Roles(...OPTION_ROLES)
  updateOption(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateQuoteOptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateOption(id, optionId, dto, user);
  }
  @Delete(':id/options/:optionId')
  @Roles(...OPTION_ROLES)
  removeOption(
    @Param('id') id: string,
    @Param('optionId') optionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeOption(id, optionId, user);
  }
  @Post(':id/sent')
  @Roles(...MANAGER_ROLES)
  sent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.sent(id, user);
  }
  @Post(':id/lose')
  @Roles(...MANAGER_ROLES)
  lose(
    @Param('id') id: string,
    @Body() dto: LoseQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.lose(id, dto, user);
  }
  @Post(':id/take')
  @Roles('LOGIST', 'DEPARTMENT_HEAD', 'ADMIN', 'DIRECTOR')
  take(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.take(id, user);
  }
  @Post(':id/win')
  @Roles(...MANAGER_ROLES)
  win(
    @Param('id') id: string,
    @Body() dto: WinQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.win(id, dto, user);
  }
  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
