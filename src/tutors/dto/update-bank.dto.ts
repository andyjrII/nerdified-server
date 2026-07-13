import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateBankDto {
  @IsNotEmpty()
  @IsString()
  bankName: string;

  @IsNotEmpty()
  @IsString()
  bankCode: string;

  @IsNotEmpty()
  @Matches(/^\d{10}$/, { message: 'Account number must be 10 digits' })
  accountNumber: string;
}
