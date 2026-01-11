import { Transform } from 'class-transformer';
import {
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

  @IsNotEmpty()
  @Transform((amount: any) => Number.parseInt(amount))
  amount: number;

  @IsString()
  @IsNotEmpty()
  reference: string;
}
