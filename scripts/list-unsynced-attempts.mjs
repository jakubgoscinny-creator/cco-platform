#!/usr/bin/env node
// CCO-T034 helper (read-only): list submitted attempts not yet replicated to
// the Podio Test Results app. Used to pick a test-account row for the
// single-row sandbox smoke before deploy.
//   Run: node --env-file=.env --env-file=.env.local scripts/list-unsynced-attempts.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT a.id, a.contact_id, c.email, c.full_name,
         a.test_podio_id, t.test_name, a.score_percent,
         a.started_at, a.submitted_at
  FROM attempts a
  JOIN contacts c ON c.podio_item_id = a.contact_id
  LEFT JOIN tests t ON t.podio_item_id = a.test_podio_id
  WHERE a.status = 'submitted' AND a.podio_test_result_item_id IS NULL
  ORDER BY a.submitted_at ASC NULLS LAST
`;

for (const r of rows) {
  console.log(
    `#${r.id} | ${r.email} | ${r.full_name ?? "—"} | "${r.test_name ?? "?"}" | ${
      r.score_percent ?? "—"
    }% | ${r.submitted_at ?? "?"}`
  );
}
console.log(`\nTotal unsynced: ${rows.length}`);
