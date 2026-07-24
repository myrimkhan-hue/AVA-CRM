import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  unreadOnly?: boolean;
}
