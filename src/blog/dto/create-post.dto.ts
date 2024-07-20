import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsUrl()
  postUrl: string;

  @IsNotEmpty()
  datePosted: Date;
}
