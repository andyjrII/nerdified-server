/*
  Warnings:

  - Added the required column `reference` to the `courseenrolment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "courseenrolment" ADD COLUMN     "reference" TEXT NOT NULL;
