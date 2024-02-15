/*
  Warnings:

  - You are about to drop the column `name` on the `courses` table. All the data in the column will be lost.
  - Added the required column `deadline` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `level` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Made the column `stack` on table `interns` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "LEVEL" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCE');

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "name",
ADD COLUMN     "deadline" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "inProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" "LEVEL" NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "interns" ALTER COLUMN "stack" SET NOT NULL;
