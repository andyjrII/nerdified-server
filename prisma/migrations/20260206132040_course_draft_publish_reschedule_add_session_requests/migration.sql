-- CreateEnum
CREATE TYPE "COURSESTATUS" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "REQUESTSTATUS" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "status" "COURSESTATUS" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "requestedStartTime" TIMESTAMP(3) NOT NULL,
    "requestedEndTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "REQUESTSTATUS" NOT NULL DEFAULT 'PENDING',
    "requestedByTutorId" INTEGER NOT NULL,
    "reviewedByAdminId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "add_session_requests" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "reason" TEXT NOT NULL,
    "status" "REQUESTSTATUS" NOT NULL DEFAULT 'PENDING',
    "requestedByTutorId" INTEGER NOT NULL,
    "reviewedByAdminId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "add_session_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_session_requests" ADD CONSTRAINT "add_session_requests_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
