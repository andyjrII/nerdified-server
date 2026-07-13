-- Track email verification for students and tutors (null = unverified).

-- AlterTable
ALTER TABLE "students" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tutors" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
