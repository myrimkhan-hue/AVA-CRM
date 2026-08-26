import { PartialType } from '@nestjs/mapped-types';
import { CreateOperatingExpenseTypeDto } from './create-operating-expense-type.dto';

export class UpdateOperatingExpenseTypeDto extends PartialType(
  CreateOperatingExpenseTypeDto,
) {}
