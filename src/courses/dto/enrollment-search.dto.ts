import { ENROLLMENTSTATUS } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

export class CourseEnrollmentSearchDto {
  @IsOptional()
  @IsString()
  search: string;

  @IsOptional()
  @IsString()
  status: ENROLLMENTSTATUS;
}
