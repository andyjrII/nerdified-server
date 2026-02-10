-- CreateEnum (idempotent: skip if exists)
DO $$ BEGIN
  CREATE TYPE "DELIVERYMODE" AS ENUM ('GROUP', 'ONE_ON_ONE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SESSIONTYPE" AS ENUM ('GROUP', 'ONE_ON_ONE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "COURSETYPE" ADD VALUE IF NOT EXISTS 'BOTH';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "priceOneOnOne" DECIMAL(10,2);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "maxOneOnOneStudents" INTEGER;

ALTER TABLE "courseenrolment" ADD COLUMN IF NOT EXISTS "deliveryMode" "DELIVERYMODE";

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "sessionType" "SESSIONTYPE" NOT NULL DEFAULT 'GROUP';

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "enrollmentId" INTEGER;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "courseenrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
