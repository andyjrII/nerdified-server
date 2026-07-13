import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreatePayoutDto {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => Number.parseInt(value))
  tutorId: number;

  /**
   * Gross amount (NGN) to settle in this payout. If omitted, the tutor's full
   * available balance is paid out. Commission is deducted server-side.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
