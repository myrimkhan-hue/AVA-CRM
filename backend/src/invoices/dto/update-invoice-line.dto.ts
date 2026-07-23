import { PartialType } from '@nestjs/mapped-types';
import { InvoiceLineDto } from './invoice-line.dto';

export class UpdateInvoiceLineDto extends PartialType(InvoiceLineDto) {}
