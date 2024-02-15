/*
  Warnings:

  - You are about to drop the column `category` on the `interns` table. All the data in the column will be lost.
  - You are about to drop the column `languages` on the `interns` table. All the data in the column will be lost.
  - Added the required column `portfolio` to the `interns` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `interns` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phoneNumber` on table `interns` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "STACK" AS ENUM ('BACKEND', 'FRONTEND');

-- AlterTable
ALTER TABLE "interns" DROP COLUMN "category",
DROP COLUMN "languages",
ADD COLUMN     "portfolio" TEXT NOT NULL,
ADD COLUMN     "stack" "STACK",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "phoneNumber" SET NOT NULL;

-- DropEnum
DROP TYPE "CATEGORY";
