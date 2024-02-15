import { PLATFORM } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsEnum(PLATFORM)
  platform: PLATFORM;

  @IsNotEmpty()
  @IsUrl()
  url: string;
}
