#!/usr/bin/env node
// Read-only: list the distinct Student-tier course folders (by tracker type)
// that render in the catalog as locked tiles for a non-enrolled viewer.
//   Run: node --env-file=.env.local scripts/list-locked-course-folders.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT student_tracker_type AS code, COUNT(*)::int AS exam_count
  FROM tests
  WHERE ready_for_portal = true
    AND lower(access_tier) = 'student'
    AND student_tracker_type IS NOT NULL
    AND student_tracker_type <> 'NA'
  GROUP BY student_tracker_type
  ORDER BY student_tracker_type;
`;

console.log(`Student-tier locked course folders (Ready-for-Portal): ${rows.length}`);
for (const r of rows) {
  console.log(`  ${String(r.code).padEnd(22)} ${r.exam_count} exams`);
}

// Also show the raw access_tier distribution so we know nothing is mislabelled.
const tiers = await sql`
  SELECT access_tier, COUNT(*)::int AS n
  FROM tests
  WHERE ready_for_portal = true
  GROUP BY access_tier
  ORDER BY n DESC;
`;
console.log(`\naccess_tier distribution (Ready-for-Portal):`);
for (const t of tiers) console.log(`  ${String(t.access_tier).padEnd(16)} ${t.n}`);
