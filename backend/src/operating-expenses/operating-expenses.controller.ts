import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import { OperatingExpenseQueryDto } from './dto/operating-expense-query.dto';
import { PayOperatingExpenseDto } from './dto/pay-operating-expense.dto';
import { UpdateOperatingExpenseDto } from './dto/update-operating-expense.dto';
import { OperatingExpensesService } from './operating-expenses.service';

@Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
@Controller('operating-expenses')
export class OperatingExpensesController {
  constructor(private readonly operatingExpensesService: OperatingExpensesService) {}

  @Get('context')
  context() {
    return this.operatingExpensesService.getContext();
  }

  @Get()
  findAll(@Query() query: OperatingExpenseQueryDto) {
    return this.operatingExpensesService.findAll(query);
  }

  @Post()
  create(
    @Body() dto: CreateOperatingExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operatingExpensesService.create(dto, user.id);
  }

  @Patch(':id/pay')
  pay(
    @Param('id') id: string,
    @Body() dto: PayOperatingExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operatingExpensesService.pay(id, dto, user.id);
  }

  @Patch(':id/unpay')
  unpay(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.operatingExpensesService.unpay(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOperatingExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operatingExpensesService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.operatingExpensesService.remove(id, user.id);
  }
}
