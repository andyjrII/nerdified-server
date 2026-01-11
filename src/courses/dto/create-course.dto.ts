import {
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { PRICINGMODEL, COURSETYPE } from '@prisma/client';

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
