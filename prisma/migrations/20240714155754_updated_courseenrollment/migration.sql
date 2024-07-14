/*
  Warnings:

  - You are about to drop the column `academicLevel` on the `students` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ClassDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('ONLINE', 'ONSITE');

-- AlterTable
ALTER TABLE "courseenrolment" ADD COLUMN     "classDays" "ClassDay"[],
ADD COLUMN     "mode" "Mode" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "preferredTime" "TimeOfDay" NOT NULL DEFAULT 'MORNING',
ADD COLUMN     "sessionsPerWeek" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "academicLevel";

-- DropEnum
DROP TYPE "ACADEMICLEVEL";

-- DropEnum
DROP TYPE "PLATFORM";
