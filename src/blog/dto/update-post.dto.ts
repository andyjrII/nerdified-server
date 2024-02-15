import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUrl()
  postUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  datePosted?: Date;
}
