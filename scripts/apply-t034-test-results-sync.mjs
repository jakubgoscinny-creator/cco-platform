#!/usr/bin/env node
// CCO-T034: idempotency key for the portal -> Podio Test Results (16234798) write.
// Run: node --env-file=.env scripts/apply-t034-test-results-sync.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE attempts
    ADD COLUMN IF NOT EXISTS podio_test_result_item_id bigint
`;

console.log("CCO-T034 migration applied: attempts.podio_test_result_item_id");

const r = await sql`
  SELECT count(*)::int AS n
  FROM attempts
  WHERE status = 'submitted' AND podio_test_result_item_id IS NULL
`;
console.log("Submitted attempts not yet replicated to Test Results:", r[0].n);
