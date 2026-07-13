-- Enforce that each Paystack payment reference can only be used for one
-- enrollment (replay/idempotency protection at the database level).
--
-- NOTE: If this migration fails with a unique-constraint violation, the
-- courseenrolment table already contains duplicate `reference` values that
-- must be cleaned up before the index can be created. Find them with:
--   SELECT reference, COUNT(*) FROM courseenrolment
--   GROUP BY reference HAVING COUNT(*) > 1;

-- CreateIndex
CREATE UNIQUE INDEX "courseenrolment_reference_key" ON "courseenrolment"("reference");
