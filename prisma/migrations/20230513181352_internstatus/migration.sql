/*
  Warnings:

  - The values [FULLSTACK] on the enum `CATEGORY` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dateEmployed` on the `interns` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `interns` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `interns` table. All the data in the column will be lost.
  - You are about to drop the `blogs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "STATUS" AS ENUM ('PENDING', 'EMPLOYED', 'REJECTED', 'WAITLIST', 'TERMINATED', 'FINISHED');

-- AlterEnum
BEGIN;
CREATE TYPE "CATEGORY_new" AS ENUM ('BACKEND', 'FRONTEND');
ALTER TABLE "interns" ALTER COLUMN "category" TYPE "CATEGORY_new" USING ("category"::text::"CATEGORY_new");
ALTER TYPE "CATEGORY" RENAME TO "CATEGORY_old";
ALTER TYPE "CATEGORY_new" RENAME TO "CATEGORY";
DROP TYPE "CATEGORY_old";
COMMIT;

-- AlterTable
ALTER TABLE "interns" DROP COLUMN "dateEmployed",
DROP COLUMN "password",
DROP COLUMN "refreshToken",
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL;

-- DropTable
DROP TABLE "blogs";

-- CreateTable
CREATE TABLE "internstatus" (
    "id" SERIAL NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "internId" INTEGER NOT NULL,
    "status" "STATUS" NOT NULL,

    CONSTRAINT "internstatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internstatus_internId_key" ON "internstatus"("internId");

-- AddForeignKey
ALTER TABLE "internstatus" ADD CONSTRAINT "internstatus_internId_fkey" FOREIGN KEY ("internId") REFERENCES "interns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
