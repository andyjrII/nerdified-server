-- Track the active LiveKit egress while a session recording is running,
-- so it can be stopped and so a session can't be double-recorded.

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "recordingEgressId" TEXT;
