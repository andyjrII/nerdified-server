import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateAdminDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsIn(['SUPER_ADMIN', 'SUB_ADMIN'])
  role: UserRole;
}
