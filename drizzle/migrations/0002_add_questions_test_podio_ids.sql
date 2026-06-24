-- CCO-T065: make the questions mirror queryable by test so exam-start can fall
-- back to the Neon mirror on a Podio outage (the 2026-06-24 HTTP-420 incident).
-- See src/lib/schema.ts (questions.testPodioIds) for the column purpose.
--
-- NOTE: hand-trimmed to ONLY the new column + GIN index, like 0001. `drizzle-kit
-- generate` emits a lot of drift here because the project applies schema via
-- one-off idempotent scripts/apply-*.mjs (T031/T033/T034/T044), never via
-- `drizzle-kit migrate`; the five other columns that generate wanted to add are
-- already live from those tasks. The apply path for THIS change is
-- scripts/apply-t065-question-test-linkage.mjs (idempotent: ADD COLUMN IF NOT
-- EXISTS + CREATE INDEX IF NOT EXISTS + a payload-JSONB backfill).
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "test_podio_ids" bigint[];
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_test_podio_ids_idx" ON "questions" USING gin ("test_podio_ids");
