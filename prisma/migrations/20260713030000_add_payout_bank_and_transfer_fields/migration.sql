-- Tutor bank details for Paystack Transfers, and transfer-tracking fields on
-- the payout record.

-- AlterTable
ALTER TABLE "tutors"
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankCode" TEXT,
  ADD COLUMN "bankAccountNumber" TEXT,
  ADD COLUMN "bankAccountName" TEXT,
  ADD COLUMN "paystackRecipientCode" TEXT;

-- AlterTable
ALTER TABLE "tutor_payouts"
  ADD COLUMN "transferCode" TEXT,
  ADD COLUMN "failureReason" TEXT;
