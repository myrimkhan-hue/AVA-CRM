import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class PayPaymentRequestDto {
  /**
   * Дата, когда деньги реально ушли. Необязательна: если не указана, берётся
   * текущий момент — прежнее поведение для обычного сценария «плачу и отмечаю».
   * Нужна потому, что оплату часто фиксируют позже фактической: по разделу
   * 4.4.3 ТЗ курс НБ РК берётся на дату оплаты, и без этого поля расход
   * пересчитывался бы по курсу дня отметки, искажая маржу сделки.
   */
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Дата оплаты должна быть корректной датой' },
  )
  paymentDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: 'Фактический курс должен быть числом с точностью до шести знаков' },
  )
  @Min(0.000001, { message: 'Фактический курс должен быть больше нуля' })
  actualExchangeRate?: number;
}
