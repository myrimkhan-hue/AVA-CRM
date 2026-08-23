import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentPaymentTextDto } from './create-document-payment-text.dto';

export class UpdateDocumentPaymentTextDto extends PartialType(
  CreateDocumentPaymentTextDto,
) {}
