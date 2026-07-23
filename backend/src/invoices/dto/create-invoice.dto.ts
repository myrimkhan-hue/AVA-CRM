import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId!: string;

  @Matches(/^[A-Z]{3}$/, {
    message: 'Код валюты должен состоять из трёх латинских букв',
  })
  currencyCode!: string;

  @IsDateString(
    { strict: true },
    { message: 'Дата счёта должна быть корректной датой' },
  )
  issueDate!: string;

  @IsDateString(
    { strict: true },
    { message: 'Срок оплаты должен быть корректной датой' },
  )
  dueDate!: string;

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  notes?: string;

  @IsArray({ message: 'Позиции счёта должны быть массивом' })
  @ArrayMinSize(1, { message: 'Добавьте хотя бы одну позицию счёта' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
