import { IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class WishListDto {
  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
  studentId: number;

  @IsNotEmpty()
  @Transform((value: any) => Number.parseInt(value))
  courseId: number;
}
