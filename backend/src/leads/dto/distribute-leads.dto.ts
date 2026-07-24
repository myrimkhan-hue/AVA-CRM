import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DistributeLeadsDto {
  @IsArray({ message: 'leadIds должен быть массивом' })
  @ArrayNotEmpty({ message: 'Выберите хотя бы один лид' })
  @IsString({ each: true })
  leadIds!: string[];

  @IsArray({ message: 'managerIds должен быть массивом' })
  @ArrayNotEmpty({ message: 'Выберите хотя бы одного менеджера' })
  @IsString({ each: true })
  managerIds!: string[];
}
