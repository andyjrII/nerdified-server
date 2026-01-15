import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSessionDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  courseId: number;

  @IsNotEmpty()
  @IsDateString()
  startTime: string; // ISO 8601 date string

  @IsNotEmpty()
  @IsDateString()
  endTime: string; // ISO 8601 date string

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
