import { IsOptional, IsString } from 'class-validator';
import { PartyRequisitesOverrideDto } from './party-requisites-override.dto';

export class GenerateContractForDealDto {
  @IsOptional()
  overrides?: PartyRequisitesOverrideDto;
}

export class GenerateContractForContractorDto {
  @IsString({ message: 'Укажите юрлицо' })
  legalEntityId!: string;

  @IsOptional()
  overrides?: PartyRequisitesOverrideDto;
}
