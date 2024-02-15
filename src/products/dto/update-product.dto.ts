import { PLATFORM } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  platform?: PLATFORM;

  @IsOptional()
  url?: string;
}
