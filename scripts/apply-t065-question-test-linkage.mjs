#!/usr/bin/env node
// CCO-T065: make the questions mirror queryable by test so exam-start can fall
// back to the Neon mirror when a live Podio sync fails (the 2026-06-24 HTTP-420
// outage). Adds questions.test_podio_ids (bigint[]) + a GIN index, then
// BACKFILLS it from the already-mirrored payload JSONB (the QB Multi Choice
// "Tests" app-ref field 137526907) — no Podio call, so it works even while
// Podio is rate-limited. The deployed app's mapPodioQuestion keeps it fresh
// thereafter. Idempotent + re-runnable.
//   Run: node --env-file=.env.local scripts/apply-t065-question-test-linkage.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const TESTS_FIELD = 137526907; // QUESTION_FIELDS.TESTS (app ref → Tests)

// 1) migrate (idempotent)
await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS test_podio_ids bigint[]`;
await sql`CREATE INDEX IF NOT EXISTS questions_test_podio_ids_idx ON questions USING gin (test_podio_ids)`;
console.log("CCO-T065 migration applied: questions.test_podio_ids (+ GIN index)");

// 2) backfill from the existing payload JSONB (Tests app-ref item_ids).
//    array_agg DISTINCT so a question linked to the same test twice dedupes.
const updated = await sql`
  UPDATE questions q
  SET test_podio_ids = sub.ids
  FROM (
    SELECT q2.podio_item_id,
           array_agg(DISTINCT (val->'value'->>'item_id')::bigint) AS ids
    FROM questions q2,
         jsonb_array_elements(q2.payload) AS field,
         jsonb_array_elements(field->'values') AS val
    WHERE (field->>'field_id')::bigint = ${TESTS_FIELD}
      AND val->'value'->>'item_id' IS NOT NULL
    GROUP BY q2.podio_item_id
  ) sub
  WHERE q.podio_item_id = sub.podio_item_id
  RETURNING q.podio_item_id`;
console.log(`Backfill: set test_podio_ids on ${updated.length} questions`);

// 3) verify
const [{ total }] = await sql`SELECT count(*)::int AS total FROM questions`;
const [{ linked }] =
  await sql`SELECT count(*)::int AS linked FROM questions WHERE test_podio_ids IS NOT NULL AND cardinality(test_podio_ids) > 0`;
console.log(`Verify: ${linked}/${total} questions now have a test linkage`);
if (linked === 0) {
  console.error("WARNING: no questions were linked — check the payload shape.");
  process.exit(1);
}
