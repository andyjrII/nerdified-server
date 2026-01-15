import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { DAYOFWEEK } from '@prisma/client';

export class CreateAvailabilityDto {
  @IsNotEmpty()
  @IsEnum(DAYOFWEEK)
  dayOfWeek: DAYOFWEEK;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (e.g., 09:00)',
  })
  startTime: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (e.g., 17:00)',
  })
  endTime: string;
}
