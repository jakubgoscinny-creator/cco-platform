#!/usr/bin/env node
// CCO-T034 diagnostic (read-only): newest attempts + replication state.
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT id, status, score_percent, podio_synced, podio_test_result_item_id,
         test_podio_id, started_at, submitted_at
  FROM attempts ORDER BY id DESC LIMIT 6
`;
console.log(JSON.stringify(rows, null, 2));
