#!/usr/bin/env node
// One-off (Jakub's request): seed PBC Chapter 1-7 results for Jakub's Contact in
// the Neon legacy_test_results mirror so the catalog's progress display can be
// tested. 6 passed + 1 attempted-but-failed (to exercise both states). Durable:
// refreshLegacyResultsForContact only UPSERTS Podio rows, never deletes these.
//   Run: node --env-file=.env.local scripts/seed-jakub-pbc-results.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const CONTACT = 2911468032; // jakub.goscinny@futuresolutionsonline.co.uk
const SCORES = [82, 91, 100, 75, 88, 70, 64]; // chapters 1..7 (64 = attempted, not passed)

// Clear any prior seed rows so a re-run is clean (these synthetic ids only).
await sql`DELETE FROM legacy_test_results WHERE contact_item_id = ${CONTACT} AND podio_item_id >= 9900000000`;

// Only the 7 MAIN chapter exams (exclude "vD1/vD2/vE1" alternates).
const tests = await sql`
  SELECT podio_item_id, test_name FROM tests
  WHERE student_tracker_type = 'PBC' AND test_name ~ '^PBC Chapter 0[1-7] Exam$'
  ORDER BY test_name`;
console.log(`Found ${tests.length} main PBC Chapter 1-7 tests in Neon`);

const now = new Date();
let i = 0;
for (const t of tests) {
  const score = SCORES[i] ?? 85;
  const passed = score >= 70;
  const fakeId = 9900000000 + i; // clearly-synthetic PK, above the real item_id range
  const taken = new Date(now.getTime() - (tests.length - i) * 86400000); // staggered days
  await sql`
    INSERT INTO legacy_test_results
      (podio_item_id, contact_item_id, app_item_id, date_taken, test_item_id,
       test_name, score_percent, passed, source, type, duration_seconds, synced_at)
    VALUES
      (${fakeId}, ${CONTACT}, ${null}, ${taken.toISOString()}, ${t.podio_item_id},
       ${t.test_name}, ${score}, ${passed}, ${"CCO Portal"}, ${"PBC"}, ${1500}, ${now.toISOString()})
    ON CONFLICT (podio_item_id) DO UPDATE SET
      test_item_id = EXCLUDED.test_item_id,
      test_name = EXCLUDED.test_name,
      score_percent = EXCLUDED.score_percent,
      passed = EXCLUDED.passed,
      synced_at = EXCLUDED.synced_at`;
  console.log(`  ${passed ? "PASS" : "fail"} ${score}%  ${t.test_name}  (test_item_id ${t.podio_item_id})`);
  i++;
}

const r = await sql`
  SELECT count(*)::int AS n, count(*) FILTER (WHERE passed)::int AS passed
  FROM legacy_test_results WHERE contact_item_id = ${CONTACT} AND type = ${"PBC"}`;
console.log(`Seeded. Jakub now has ${r[0].n} PBC results (${r[0].passed} passed) in the mirror.`);
