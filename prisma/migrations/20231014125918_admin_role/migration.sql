-- CreateEnum
CREATE TYPE "ROLE" AS ENUM ('SUPER', 'SUB');

-- AlterTable
ALTER TABLE "admin" ADD COLUMN     "role" "ROLE" NOT NULL DEFAULT 'SUB';
