import { IsDateString } from 'class-validator';

export class FetchNbrkDto {
  @IsDateString(
    { strict: true },
    { message: 'Дата загрузки должна быть корректной датой' },
  )
  date!: string;
}
