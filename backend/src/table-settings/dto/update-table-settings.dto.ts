import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';

const TRANSPORTATION_COLUMN_KEYS = [
  'num',
  'client',
  'route',
  'transport',
  'leg',
  'status',
  'plan',
  'fact',
  'manager',
  'vehicle',
  'weight',
  'volume',
  'legsCount',
] as const;

export class TableColumnSettingDto {
  @IsIn(TRANSPORTATION_COLUMN_KEYS, { message: 'Указана неизвестная колонка таблицы' })
  key!: string;

  @IsBoolean({ message: 'Видимость колонки должна быть логическим значением' })
  visible!: boolean;
}

export class UpdateTableSettingsDto {
  @IsArray({ message: 'Настройки колонок должны быть списком' })
  @ArrayMaxSize(TRANSPORTATION_COLUMN_KEYS.length, { message: 'Слишком много колонок в настройках' })
  @ValidateNested({ each: true })
  @Type(() => TableColumnSettingDto)
  columns!: TableColumnSettingDto[];
}
