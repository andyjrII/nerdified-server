import { LEVEL } from '@prisma/client';
import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumberString()
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  deadline?: Date;

  @IsOptional()
  level?: LEVEL;
}
