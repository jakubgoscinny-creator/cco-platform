#!/usr/bin/env node
// CCO-T034 diagnostic (read-only): when did Podio writes last succeed?
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const total = await sql`SELECT count(*)::int n FROM attempts WHERE status='submitted'`;
const synced = await sql`SELECT count(*)::int n, max(submitted_at) last FROM attempts WHERE podio_synced = true`;
const resultSynced = await sql`SELECT count(*)::int n FROM attempts WHERE podio_test_result_item_id IS NOT NULL`;

console.log("submitted attempts:        ", total[0].n);
console.log("podio_synced=true (Attempts):", synced[0].n, "| last:", synced[0].last);
console.log("Test Results written:       ", resultSynced[0].n);
