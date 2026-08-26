import { IsDateString } from 'class-validator';

export class PayOperatingExpenseDto {
  @IsDateString(
    { strict: true },
    { message: 'Дата оплаты должна быть корректной датой' },
  )
  paidAt!: string;
}
