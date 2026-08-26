import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateOperatingExpenseTypeDto } from './dto/create-operating-expense-type.dto';
import { UpdateOperatingExpenseTypeDto } from './dto/update-operating-expense-type.dto';
import { OperatingExpensesService } from './operating-expenses.service';

@Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
@Controller('operating-expense-types')
export class OperatingExpenseTypesController {
  constructor(private readonly operatingExpensesService: OperatingExpensesService) {}

  @Get()
  findAll() {
    return this.operatingExpensesService.findAllTypes();
  }

  @Post()
  create(
    @Body() dto: CreateOperatingExpenseTypeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operatingExpensesService.createType(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOperatingExpenseTypeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.operatingExpensesService.updateType(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.operatingExpensesService.removeType(id, user.id);
  }
}
