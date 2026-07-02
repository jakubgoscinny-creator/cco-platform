-- CCO-T077: Podio-hosted image attachments (Supermenu embeds) for a question,
-- resolved lazily by resolveQuestionImages() -- see src/lib/sync.ts and
-- src/lib/schema.ts (questions.imageFiles) for why this can't be inline HTML.
-- NULL = not yet resolved; [] = resolved, confirmed no images.
--
-- Hand-trimmed to only the new column, following the 0001/0002 convention
-- (this project applies schema via idempotent scripts/apply-*.mjs, never
-- `drizzle-kit migrate`). Apply path: scripts/apply-t077-question-images.mjs.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "image_files" jsonb;
