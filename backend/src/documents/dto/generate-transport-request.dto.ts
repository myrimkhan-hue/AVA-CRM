import { IsOptional, IsString } from 'class-validator';
import { PartyRequisitesOverrideDto } from './party-requisites-override.dto';

export class GenerateTransportRequestDto {
  @IsOptional() @IsString({ message: 'Способ оплаты должен быть строкой' })
  paymentMethod?: string;

  @IsOptional() @IsString({ message: 'Условия оплаты должны быть строкой' })
  paymentConditions?: string;

  @IsOptional() @IsString({ message: 'Список документов должен быть строкой' })
  documents?: string;

  @IsOptional() @IsString({ message: 'Примечание должно быть строкой' })
  notes?: string;

  @IsOptional()
  overrides?: PartyRequisitesOverrideDto;
}
