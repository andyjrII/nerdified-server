import { IsEnum, IsOptional, IsString } from 'class-validator';
import { REQUESTSTATUS } from '@prisma/client';

export class ReviewRequestDto {
  @IsEnum(REQUESTSTATUS)
  status: REQUESTSTATUS;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
