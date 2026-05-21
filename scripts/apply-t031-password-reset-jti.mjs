#!/usr/bin/env node
// CCO-T031: single-use enforcement for password-reset JWTs.
//
// Adds contacts.password_reset_jti (text, nullable). When /forgot-password
// issues a reset token, the portal stores its jti claim here. /reset-password
// verifies the inbound jti matches AND clears the column on consumption.
// Replays within the 30-min TTL are therefore rejected.
//
// Idempotent via ADD COLUMN IF NOT EXISTS.
//
// Usage:
//   node --env-file=.env scripts/apply-t031-password-reset-jti.mjs

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS password_reset_jti text
`;

console.log("Schema applied.");

const c = await sql`
  SELECT count(*)::int AS total,
         count(password_reset_jti)::int AS with_outstanding
  FROM contacts
`;
console.log(
  "Contacts:",
  c[0].total,
  "rows;",
  c[0].with_outstanding,
  "with outstanding reset token (expected 0 immediately after first apply)."
);
