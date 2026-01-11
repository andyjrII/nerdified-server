import {
  IsNumberString,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { PRICINGMODEL, COURSETYPE } from '@prisma/client';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  price?: number;

  @IsOptional()
  @IsEnum(PRICINGMODEL)
  pricingModel?: PRICINGMODEL;

  @IsOptional()
  @IsEnum(COURSETYPE)
  courseType?: COURSETYPE;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsString()
  curriculum?: string;

  @IsOptional()
  @IsString()
  outcomes?: string;
}
