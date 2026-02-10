import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { DELIVERYMODE } from '@prisma/client';

export class CourseEnrollmentDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Transform((courseId: any) => Number.parseInt(courseId))
  courseId: number;

  @IsNotEmpty()
  @Transform((amount: any) => Number.parseInt(amount))
  amount: number;

  /** When course is BOTH: GROUP or ONE_ON_ONE */
  @IsOptional()
  @IsEnum(DELIVERYMODE)
  deliveryMode?: DELIVERYMODE;

  @IsString()
  @IsNotEmpty()
  reference: string;
}
