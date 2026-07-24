import { IsString, MinLength } from 'class-validator';

export class ReissuePaymentRequestDto {
  @IsString({ message: 'payerLegalEntityId должен быть строкой' })
  @MinLength(1, { message: 'Укажите юрлицо, которое фактически оплатило расход' })
  payerLegalEntityId!: string;
}
