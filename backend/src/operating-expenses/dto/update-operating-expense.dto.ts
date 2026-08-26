import { PartialType } from '@nestjs/mapped-types';
import { CreateOperatingExpenseDto } from './create-operating-expense.dto';

export class UpdateOperatingExpenseDto extends PartialType(
  CreateOperatingExpenseDto,
) {}
