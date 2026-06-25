#!/usr/bin/env node
// CCO-T068: extend the existing `feedback` table for the per-question feedback
// channel — issue category, the dedicated-Podio-app item id (idempotency /
// traceability, like attempts.podio_test_result_item_id), and the reporter's
// contact id. All additive + nullable; safe to run against prod before deploy.
// Idempotent + re-runnable.
//   Run: node --env-file=.env.local scripts/apply-t068-feedback-columns.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS issue_type text`;
await sql`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS podio_item_id bigint`;
await sql`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS contact_id bigint`;
console.log("CCO-T068 migration applied: feedback.issue_type + podio_item_id + contact_id");

// verify the live shape
const cols = await sql`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'feedback'
  ORDER BY ordinal_position`;
console.table(cols);
