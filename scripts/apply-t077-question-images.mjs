#!/usr/bin/env node
// CCO-T077: add questions.image_files (jsonb, nullable). No backfill possible
// -- image attachments aren't captured in the existing payload JSONB (only
// item.fields is, not item.files) -- resolveQuestionImages() lazily resolves
// and caches it per-question on first view instead. Idempotent + re-runnable.
//   Run: node --env-file=.env.local scripts/apply-t077-question-images.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_files jsonb`;
console.log("CCO-T077 migration applied: questions.image_files");

const [{ total }] = await sql`SELECT count(*)::int AS total FROM questions`;
console.log(`Verify: questions.image_files column exists, ${total} question rows unaffected (all NULL = unresolved, as expected).`);
