-- The platform is online-only; a student's physical address was collected but
-- never used by any feature. Remove it.

-- AlterTable
ALTER TABLE "students" DROP COLUMN "address";
