/*
  Warnings:

  - Added the required column `datePosted` to the `blog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `blog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "blog" ADD COLUMN     "datePosted" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "imagePath" TEXT;
