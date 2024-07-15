/*
  Warnings:

  - The `classDays` column on the `courseenrolment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `mode` column on the `courseenrolment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `preferredTime` column on the `courseenrolment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CLASSDAY" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "TIMEOFDAY" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "MODE" AS ENUM ('ONLINE', 'ONSITE');

-- AlterTable
ALTER TABLE "courseenrolment" DROP COLUMN "classDays",
ADD COLUMN     "classDays" "CLASSDAY"[],
DROP COLUMN "mode",
ADD COLUMN     "mode" "MODE" NOT NULL DEFAULT 'ONLINE',
DROP COLUMN "preferredTime",
ADD COLUMN     "preferredTime" "TIMEOFDAY" NOT NULL DEFAULT 'MORNING';

-- DropEnum
DROP TYPE "ClassDay";

-- DropEnum
DROP TYPE "Mode";

-- DropEnum
DROP TYPE "TimeOfDay";
