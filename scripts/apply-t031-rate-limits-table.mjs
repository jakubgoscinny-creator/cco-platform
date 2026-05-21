#!/usr/bin/env node
// CCO-T031 hardening: create the rate_limits table used by
// src/lib/rate-limit.ts to throttle /forgot-password per IP.
// Idempotent via IF NOT EXISTS.
//
// Run: node --env-file=.env scripts/apply-t031-rate-limits-table.mjs

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS rate_limits (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("rate_limits table ready.");
const c = await sql`SELECT count(*)::int AS total FROM rate_limits`;
console.log("rows:", c[0].total);
