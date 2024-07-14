/*
  Warnings:

  - You are about to drop the column `detials` on the `courses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "detials",
ADD COLUMN     "details" TEXT;
