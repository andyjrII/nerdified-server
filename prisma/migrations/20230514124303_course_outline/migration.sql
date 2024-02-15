/*
  Warnings:

  - You are about to drop the column `description` on the `courses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "description";

-- CreateTable
CREATE TABLE "courseoutline" (
    "id" SERIAL NOT NULL,
    "outline" TEXT[],
    "courseId" INTEGER NOT NULL,

    CONSTRAINT "courseoutline_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "courseoutline" ADD CONSTRAINT "courseoutline_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
