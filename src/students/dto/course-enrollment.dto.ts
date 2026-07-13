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

  /**
   * Display-only amount sent by the client. NOT trusted for enrollment — the
   * server derives the authoritative price from the course and verifies the
   * paid amount with Paystack. Kept optional for backward compatibility.
   */
  @IsOptional()
  @Transform((amount: any) => Number.parseInt(amount))
  amount?: number;

  /** When course is BOTH: GROUP or ONE_ON_ONE */
  @IsOptional()
  @IsEnum(DELIVERYMODE)
  deliveryMode?: DELIVERYMODE;

  @IsString()
  @IsNotEmpty()
  reference: string;
}
