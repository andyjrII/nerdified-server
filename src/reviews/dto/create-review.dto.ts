import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
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
