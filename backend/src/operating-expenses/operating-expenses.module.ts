import { Module } from '@nestjs/common';
import { OperatingExpenseTypesController } from './operating-expense-types.controller';
import { OperatingExpensesController } from './operating-expenses.controller';
import { OperatingExpensesService } from './operating-expenses.service';

@Module({
  controllers: [OperatingExpensesController, OperatingExpenseTypesController],
  providers: [OperatingExpensesService],
  exports: [OperatingExpensesService],
})
export class OperatingExpensesModule {}
