import { IsNotEmpty, IsString } from 'class-validator';

export class WinQuoteDto {
  @IsString({ message: 'optionId должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите выбранный вариант расчёта' })
  optionId!: string;
}
