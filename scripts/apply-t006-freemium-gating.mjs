#!/usr/bin/env node
// CCO-T006: schema additions for freemium gating.
// - contacts.subscription_status: nullable text; Mary's "active" values are
//   "Monthly (Grandfathered)", "Monthly (26)", "Active Annual", "Monthly".
//   Anything else (including NULL) is treated as non-subscriber.
// - tests.access_tier: NOT NULL DEFAULT 'Member' (fail-closed: anything
//   Mary hasn't explicitly tagged Free stays members-only).
//
// Idempotent via ADD COLUMN IF NOT EXISTS.

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

await sql`
  ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS subscription_status text
`;

await sql`
  ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'Member'
`;

console.log("Schema applied.");

const c = await sql`
  SELECT count(*)::int AS total,
         count(subscription_status)::int AS with_status
  FROM contacts
`;
console.log(
  "Contacts:",
  c[0].total,
  "rows;",
  c[0].with_status,
  "have subscription_status (will be populated by next sign-in / sync)."
);

const t = await sql`
  SELECT access_tier, count(*)::int AS n
  FROM tests
  GROUP BY access_tier
  ORDER BY access_tier
`;
console.log("Tests by access_tier:", t);
