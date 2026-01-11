/*
  Warnings:

  - You are about to drop the column `classDays` on the `courseenrolment` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `courseenrolment` table. All the data in the column will be lost.
  - You are about to drop the column `preferredTime` on the `courseenrolment` table. All the data in the column will be lost.
  - You are about to drop the column `sessionsPerWeek` on the `courseenrolment` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `courses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tutorId,title]` on the table `courses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tutorId` to the `courses` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PRICINGMODEL" AS ENUM ('PER_COURSE', 'PER_SESSION');

-- CreateEnum
CREATE TYPE "COURSETYPE" AS ENUM ('ONE_ON_ONE', 'GROUP');

-- CreateEnum
CREATE TYPE "DAYOFWEEK" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SESSIONSTATUS" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BOOKINGSTATUS" AS ENUM ('CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SENDERTYPE" AS ENUM ('STUDENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "PAYOUTSTATUS" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NOTIFICATIONTYPE" AS ENUM ('CLASS_REMINDER', 'SCHEDULE_CHANGE', 'MESSAGE', 'ENROLLMENT', 'PAYMENT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "CLASSDAY" ADD VALUE 'SUNDAY';

-- DropIndex
DROP INDEX "courses_title_key";

-- AlterTable
ALTER TABLE "courseenrolment" DROP COLUMN "classDays",
DROP COLUMN "mode",
DROP COLUMN "preferredTime",
DROP COLUMN "sessionsPerWeek",
ADD COLUMN     "certificateUrl" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "details",
ADD COLUMN     "courseType" "COURSETYPE" NOT NULL DEFAULT 'ONE_ON_ONE',
ADD COLUMN     "curriculum" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "maxStudents" INTEGER,
ADD COLUMN     "outcomes" TEXT,
ADD COLUMN     "pricingModel" "PRICINGMODEL" NOT NULL DEFAULT 'PER_COURSE',
ADD COLUMN     "tutorId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "tutors" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imagePath" TEXT,
    "bio" TEXT,
    "qualifications" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "tutors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_availability" (
    "id" SERIAL NOT NULL,
    "tutorId" INTEGER NOT NULL,
    "dayOfWeek" "DAYOFWEEK" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "tutorId" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "SESSIONSTATUS" NOT NULL DEFAULT 'SCHEDULED',
    "meetingUrl" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_bookings" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "BOOKINGSTATUS" NOT NULL DEFAULT 'CONFIRMED',
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "session_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_attendance" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" SERIAL NOT NULL,
    "senderType" "SENDERTYPE" NOT NULL,
    "studentSenderId" INTEGER,
    "tutorSenderId" INTEGER,
    "studentReceiverId" INTEGER,
    "tutorReceiverId" INTEGER,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_chat_messages" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "senderType" "SENDERTYPE" NOT NULL,
    "message" TEXT NOT NULL,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_payouts" (
    "id" SERIAL NOT NULL,
    "tutorId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "status" "PAYOUTSTATUS" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "tutorId" INTEGER,
    "type" "NOTIFICATIONTYPE" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutors_email_key" ON "tutors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tutors_phoneNumber_key" ON "tutors"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "session_bookings_sessionId_studentId_key" ON "session_bookings"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendance_sessionId_studentId_key" ON "session_attendance"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_tutorId_title_key" ON "courses"("tutorId", "title");

-- AddForeignKey
ALTER TABLE "tutors" ADD CONSTRAINT "tutors_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings" ADD CONSTRAINT "session_bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_studentSenderId_fkey" FOREIGN KEY ("studentSenderId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_tutorSenderId_fkey" FOREIGN KEY ("tutorSenderId") REFERENCES "tutors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_studentReceiverId_fkey" FOREIGN KEY ("studentReceiverId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_tutorReceiverId_fkey" FOREIGN KEY ("tutorReceiverId") REFERENCES "tutors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chat_messages" ADD CONSTRAINT "course_chat_messages_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_payouts" ADD CONSTRAINT "tutor_payouts_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
