import { ENROLLMENTSTATUS } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
  courseId: number;

  @IsNotEmpty()
  @IsEnum(ENROLLMENTSTATUS)
  status: ENROLLMENTSTATUS;
}
