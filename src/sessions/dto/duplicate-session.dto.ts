import { IsDateString, IsNotEmpty } from 'class-validator';

export class DuplicateSessionDto {
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @IsNotEmpty()
  @IsDateString()
  endTime: string;
}
