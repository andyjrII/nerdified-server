import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsNumberString()
  rating: number;

  @IsNotEmpty()
  @IsString()
  comment: string;

  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
  studentId: number;

  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
  courseId: number;
}
