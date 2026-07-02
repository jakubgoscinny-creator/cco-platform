#!/usr/bin/env node
// CCO-T033: per-test Student tracker type + per-Contact enrolled tracker types.
// Additive + nullable, so it is safe to apply BEFORE deploying the new code
// (Drizzle's existing select lists ignore unknown columns).
//   Run: node --env-file=.env.local scripts/apply-t033-tier-gating.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE tests ADD COLUMN IF NOT EXISTS student_tracker_type text`;
await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS enrolled_tracker_types text[]`;

console.log(
  "CCO-T033 migration applied: tests.student_tracker_type, contacts.enrolled_tracker_types"
);

const t = await sql`SELECT count(*)::int AS n FROM tests WHERE student_tracker_type IS NOT NULL`;
const c = await sql`SELECT count(*)::int AS n FROM contacts WHERE enrolled_tracker_types IS NOT NULL`;
console.log(`tests with student_tracker_type: ${t[0].n} (populates on next test sync)`);
console.log(`contacts with enrolled_tracker_types: ${c[0].n} (populates on next sign-in / SSO)`);
