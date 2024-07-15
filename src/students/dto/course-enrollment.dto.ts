import { TIMEOFDAY, MODE, CLASSDAY } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';

export class CourseEnrollmentDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Transform((courseId: any) => Number.parseInt(courseId))
  courseId: number;

  @IsNumberString()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsArray()
  @IsNotEmpty()
  classDays: CLASSDAY[];

  @IsString()
  @IsNotEmpty()
  preferredTime: TIMEOFDAY;

  @IsString()
  @IsNotEmpty()
  mode: MODE;
}
