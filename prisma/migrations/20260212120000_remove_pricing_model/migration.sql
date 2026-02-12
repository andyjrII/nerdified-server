-- AlterTable
ALTER TABLE "courses" DROP COLUMN IF EXISTS "pricingModel";

-- DropEnum
DROP TYPE IF EXISTS "PRICINGMODEL";
