import { IsDateString, IsOptional, IsString } from 'class-validator';

export class InvoiceContextQueryDto {
  @IsString({ message: 'dealId должен быть строкой' })
  dealId!: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата счёта должна быть корректной датой' },
  )
  issueDate?: string;
}
