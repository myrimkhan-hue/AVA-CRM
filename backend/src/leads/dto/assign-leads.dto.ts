import { ArrayNotEmpty, IsArray, IsString, MinLength } from 'class-validator';

export class AssignLeadsDto {
  @IsArray({ message: 'leadIds должен быть массивом' })
  @ArrayNotEmpty({ message: 'Выберите хотя бы один лид' })
  @IsString({ each: true })
  leadIds!: string[];

  @IsString({ message: 'responsibleId должен быть строкой' })
  @MinLength(1, { message: 'Укажите ответственного' })
  responsibleId!: string;
}
