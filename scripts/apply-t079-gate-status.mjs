#!/usr/bin/env node
// CCO-T079: add questions.gate_status_option_id (the real "Question status"
// Live/Draft portal gate, Podio field 276090193 -- confirmed live 2026-07-02
// as the one active field among 21 fields all labeled "Question status" on
// the QB Multi Choice app; 20 others are deleted legacy duplicates).
// BACKFILLS from the already-mirrored payload JSONB (same pattern as
// apply-t065-question-test-linkage.mjs) -- no live Podio call, so it works
// even during a Podio outage and doesn't burn rate-limit budget.
// Idempotent + re-runnable.
//   Run: node --env-file=.env.local scripts/apply-t079-gate-status.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const GATE_STATUS_FIELD = 276090193; // QUESTION_FIELDS.GATE_STATUS

// 1) migrate (idempotent)
await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS gate_status_option_id integer`;
console.log("CCO-T079 migration applied: questions.gate_status_option_id");

// 2) backfill from the existing payload JSONB (category field -> option id).
const updated = await sql`
  UPDATE questions q
  SET gate_status_option_id = sub.option_id
  FROM (
    SELECT q2.podio_item_id,
           (val->'value'->>'id')::int AS option_id
    FROM questions q2,
         jsonb_array_elements(q2.payload) AS field,
         jsonb_array_elements(field->'values') AS val
    WHERE (field->>'field_id')::bigint = ${GATE_STATUS_FIELD}
      AND val->'value'->>'id' IS NOT NULL
  ) sub
  WHERE q.podio_item_id = sub.podio_item_id
  RETURNING q.podio_item_id`;
console.log(`Backfill: set gate_status_option_id on ${updated.length} questions`);

// 3) verify against the live counts already confirmed via the Podio API
// (Current=1060, Under Review=107, Draft/Updated/Archived=0 platform-wide;
// MTA specifically: 30 Current). This backfill reads from payload, not a
// fresh Podio call, so exact parity isn't guaranteed for anything synced
// since the live check -- report the distribution for a sanity eyeball.
const dist = await sql`
  SELECT gate_status_option_id, count(*)::int AS n
  FROM questions
  GROUP BY gate_status_option_id
  ORDER BY n DESC`;
console.log("Verify: gate_status_option_id distribution:", dist);

const [{ mtaCurrent }] = await sql`
  SELECT count(*)::int AS "mtaCurrent"
  FROM questions q
  JOIN tests t ON t.podio_item_id = ANY(q.test_podio_ids)
  WHERE t.student_tracker_type = 'MTA' AND q.gate_status_option_id = 1`;
console.log(`Verify: MTA questions with gate_status_option_id=1 (Current): ${mtaCurrent} (expect ~30)`);
