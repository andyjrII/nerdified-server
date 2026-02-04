import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class SigninDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  /** Required for platform sign-in (student/tutor). Omit for admin sign-in. */
  @IsOptional()
  @IsIn(['STUDENT', 'TUTOR'])
  role?: 'STUDENT' | 'TUTOR';
}
