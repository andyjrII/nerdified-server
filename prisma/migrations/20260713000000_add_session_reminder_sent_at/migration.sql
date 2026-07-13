-- Track when class-reminder notifications were sent for a session, so the
-- reminder scheduler never notifies the same session twice.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
