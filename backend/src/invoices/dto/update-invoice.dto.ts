import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата счёта должна быть корректной датой' },
  )
  issueDate?: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Срок оплаты должен быть корректной датой' },
  )
  dueDate?: string;

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string | null;
}
