import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class BookSessionDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  sessionId: number;
}
