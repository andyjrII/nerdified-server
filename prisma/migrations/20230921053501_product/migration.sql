/*
  Warnings:

  - You are about to drop the column `gender` on the `students` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PLATFORM" AS ENUM ('MOBILE', 'WEB', 'DESKTOP');

-- AlterTable
ALTER TABLE "students" DROP COLUMN "gender";

-- DropEnum
DROP TYPE "GENDER";

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "platform" "PLATFORM" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "imagePath" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_title_key" ON "products"("title");

-- CreateIndex
CREATE UNIQUE INDEX "products_url_key" ON "products"("url");
