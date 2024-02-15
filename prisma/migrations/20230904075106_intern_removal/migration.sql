/*
  Warnings:

  - You are about to drop the column `inProgress` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the `courseoutline` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `interns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `internstatus` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[title]` on the table `courses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `courses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicLevel` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GENDER" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ENROLLMENTSTATUS" AS ENUM ('PENDING', 'STARTED', 'DROPPED', 'FINISHED');

-- CreateEnum
CREATE TYPE "ACADEMICLEVEL" AS ENUM ('OLEVEL', 'ND', 'HND', 'BSC', 'GRADUATE');

-- DropForeignKey
ALTER TABLE "courseoutline" DROP CONSTRAINT "courseoutline_courseId_fkey";

-- DropForeignKey
ALTER TABLE "internstatus" DROP CONSTRAINT "internstatus_internId_fkey";

-- AlterTable
ALTER TABLE "courseenrolment" ADD COLUMN     "status" "ENROLLMENTSTATUS" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "inProgress",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "outlinePath" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "academicLevel" "ACADEMICLEVEL" NOT NULL,
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "gender" "GENDER" NOT NULL,
ADD COLUMN     "imagePath" TEXT;

-- DropTable
DROP TABLE "courseoutline";

-- DropTable
DROP TABLE "interns";

-- DropTable
DROP TABLE "internstatus";

-- DropEnum
DROP TYPE "STACK";

-- DropEnum
DROP TYPE "STATUS";

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "courses_title_key" ON "courses"("title");
