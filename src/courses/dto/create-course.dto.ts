import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { COURSETYPE } from '@prisma/client';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumberString()
  price: number;

  /** When courseType BOTH: 1:1 price (higher than group price) */
  @IsOptional()
  @IsNumberString()
  priceOneOnOne?: number;

  @IsOptional()
  @IsEnum(COURSETYPE)
  courseType?: COURSETYPE;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  /** When courseType BOTH: cap for 1:1 enrollments */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOneOnOneStudents?: number;

  @IsOptional()
  @IsString()
  curriculum?: string;

  @IsOptional()
  @IsString()
  outcomes?: string;
}
