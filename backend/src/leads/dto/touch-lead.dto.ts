import { LeadNotInterestedReason, LeadStatus } from '@prisma/client';
import { IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';

export class TouchLeadDto {
  @IsEnum(LeadStatus, { message: 'Указан неизвестный статус лида' })
  status!: LeadStatus;

  @IsString({ message: 'Комментарий должен быть строкой' })
  @MinLength(1, { message: 'Укажите комментарий к звонку' })
  comment!: string;

  @ValidateIf((dto: TouchLeadDto) => dto.status === LeadStatus.CALL_BACK)
  @IsString({ message: 'Укажите дату и время перезвона' })
  @MinLength(1, { message: 'Укажите дату и время перезвона' })
  callBackAt?: string;

  @ValidateIf((dto: TouchLeadDto) => dto.status === LeadStatus.NOT_INTERESTED)
  @IsEnum(LeadNotInterestedReason, { message: 'Укажите причину «Не интересно»' })
  notInterestedReason?: LeadNotInterestedReason;

  @ValidateIf((dto: TouchLeadDto) => dto.notInterestedReason === LeadNotInterestedReason.OTHER)
  @IsString({ message: 'Для причины «Другое» укажите комментарий' })
  @MinLength(1, { message: 'Для причины «Другое» укажите комментарий' })
  notInterestedComment?: string;
}
