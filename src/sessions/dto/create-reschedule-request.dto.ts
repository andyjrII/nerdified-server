import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRescheduleRequestDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  sessionId: number;

  @IsNotEmpty()
  @IsDateString()
  requestedStartTime: string;

  @IsNotEmpty()
  @IsDateString()
  requestedEndTime: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Please provide a reason (at least 10 characters)' })
  reason: string;
}
