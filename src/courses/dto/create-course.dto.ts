import { LEVEL } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsNumberString()
  price: number;

  @IsNotEmpty()
  @IsEnum(LEVEL)
  level: LEVEL;

  @IsNotEmpty()
  deadline: Date;
}
