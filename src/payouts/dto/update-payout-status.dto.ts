import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PAYOUTSTATUS } from '@prisma/client';

export class UpdatePayoutStatusDto {
  @IsEnum(PAYOUTSTATUS)
  status: PAYOUTSTATUS;

  /** Bank/transfer reference recorded when the payout is processed or completed. */
  @IsOptional()
  @IsString()
  paymentReference?: string;
}
