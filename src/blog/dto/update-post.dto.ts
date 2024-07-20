import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUrl()
  postUrl?: string;

  @IsOptional()
  datePosted?: Date;
}
