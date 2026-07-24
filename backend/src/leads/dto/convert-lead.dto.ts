import { IsString, MinLength } from 'class-validator';

export class ConvertLeadDto {
  @IsString({ message: 'Укажите юрлицо' })
  @MinLength(1, { message: 'Укажите юрлицо' })
  legalEntityId!: string;
}
