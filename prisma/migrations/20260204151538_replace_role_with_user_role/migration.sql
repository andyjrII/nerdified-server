-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TUTOR', 'SUPER_ADMIN', 'SUB_ADMIN');

-- Add temporary column and migrate data (SUPER -> SUPER_ADMIN, SUB -> SUB_ADMIN)
ALTER TABLE "admin" ADD COLUMN "role_new" "UserRole";
UPDATE "admin" SET "role_new" = 'SUPER_ADMIN' WHERE "role"::text = 'SUPER';
UPDATE "admin" SET "role_new" = 'SUB_ADMIN' WHERE "role"::text = 'SUB' OR "role_new" IS NULL;
ALTER TABLE "admin" ALTER COLUMN "role_new" SET NOT NULL;
ALTER TABLE "admin" ALTER COLUMN "role_new" SET DEFAULT 'SUB_ADMIN';

-- Drop old column and rename
ALTER TABLE "admin" DROP COLUMN "role";
ALTER TABLE "admin" RENAME COLUMN "role_new" TO "role";

-- DropEnum
DROP TYPE "ROLE";
