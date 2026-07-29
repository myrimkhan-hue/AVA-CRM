import { IsString, MinLength } from 'class-validator';

export class LinkUnmatchedDto {
  @IsString({ message: 'Укажите контрагента' })
  @MinLength(1, { message: 'Укажите контрагента' })
  contractorId!: string;
}
