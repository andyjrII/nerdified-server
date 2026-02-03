import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTimezoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
