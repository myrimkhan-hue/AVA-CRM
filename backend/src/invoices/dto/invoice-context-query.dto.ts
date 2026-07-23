import { IsDateString, IsOptional, IsString } from 'class-validator';

export class InvoiceContextQueryDto {
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId!: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата счёта должна быть корректной датой' },
  )
  issueDate?: string;
}
