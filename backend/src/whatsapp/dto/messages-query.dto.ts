import { IsOptional, IsString } from 'class-validator';

export class MessagesQueryDto {
  @IsOptional()
  @IsString()
  contractorId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;
}
