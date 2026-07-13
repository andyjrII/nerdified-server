import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Body for `PATCH /auth/me/password`. The user is identified from the JWT
 * (sub + role), so no id is needed in the body.
 */
export class UpdateMyPasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
