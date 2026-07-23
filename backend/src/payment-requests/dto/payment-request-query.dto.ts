import { Transform } from 'class-transformer';
import { PaymentRequestStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class PaymentRequestQueryDto {
  @IsOptional()
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId?: string;

  @IsOptional()
  @IsEnum(PaymentRequestStatus, {
    message: 'Указан неизвестный статус заявки',
  })
  status?: PaymentRequestStatus;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({
    message: 'includeDeleted должен быть логическим значением',
  })
  includeDeleted?: boolean;
}
