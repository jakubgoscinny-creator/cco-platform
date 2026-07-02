#!/usr/bin/env node
// CCO-T034 helper (read-only): inspect one attempt's replication state.
//   Run: node --env-file=.env --env-file=.env.local scripts/check-attempt.mjs <attemptId>
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const id = Number(process.argv[2]);

const [r] = await sql`
  SELECT a.id, a.status, a.score_percent, a.podio_synced, a.podio_test_result_item_id,
         a.started_at, a.submitted_at, a.test_podio_id,
         c.podio_item_id AS contact_id, c.email, c.full_name, t.test_name
  FROM attempts a
  JOIN contacts c ON c.podio_item_id = a.contact_id
  LEFT JOIN tests t ON t.podio_item_id = a.test_podio_id
  WHERE a.id = ${id}
`;

console.log(JSON.stringify(r, null, 2));
