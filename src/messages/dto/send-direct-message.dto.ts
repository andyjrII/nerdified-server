import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { SENDERTYPE } from '@prisma/client';

export class SendDirectMessageDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  receiverId: number;

  @IsNotEmpty()
  @IsEnum(SENDERTYPE)
  receiverType: SENDERTYPE;

  @IsNotEmpty()
  @IsString()
  message: string;
}
