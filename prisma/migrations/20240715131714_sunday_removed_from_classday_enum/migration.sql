/*
  Warnings:

  - The values [SUNDAY] on the enum `ClassDay` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `description` on the `courses` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ClassDay_new" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');
ALTER TABLE "courseenrolment" ALTER COLUMN "classDays" TYPE "ClassDay_new"[] USING ("classDays"::text::"ClassDay_new"[]);
ALTER TYPE "ClassDay" RENAME TO "ClassDay_old";
ALTER TYPE "ClassDay_new" RENAME TO "ClassDay";
DROP TYPE "ClassDay_old";
COMMIT;

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "description",
ADD COLUMN     "details" TEXT;
