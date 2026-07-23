import { IsOptional, IsString } from 'class-validator';

export class PaymentRequestContextQueryDto {
  @IsString({ message: 'transportationId должен быть строкой' })
  transportationId!: string;

  @IsOptional()
  @IsString({ message: 'legId должен быть строкой' })
  legId?: string;
}
