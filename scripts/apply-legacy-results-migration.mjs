#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS legacy_test_results (
    podio_item_id     bigint PRIMARY KEY,
    contact_item_id   bigint NOT NULL,
    app_item_id       integer,
    date_taken        timestamptz,
    test_item_id      bigint,
    test_name         text,
    score_percent     numeric(5,2),
    passed            boolean,
    source            text,
    type              text,
    duration_seconds  integer,
    legacy_cert_url   text,
    legacy_view_url   text,
    synced_at         timestamptz DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS legacy_results_contact_date_idx
    ON legacy_test_results (contact_item_id, date_taken)
`;

console.log("Schema applied.");
const r = await sql`SELECT count(*)::int AS n FROM legacy_test_results`;
console.log("Row count:", r[0].n);
