#!/usr/bin/env node
/**
 * One-shot migration for the Profile-auth -> Contact-auth refactor.
 *
 * - Remaps Jakub's Profile id (3251178998) -> his Contact id (2911468032)
 *   so his existing attempts and certificates stay associated.
 * - Clears sessions (everyone re-logs in).
 * - Clears the contacts mirror (it currently caches Profile records;
 *   will repopulate from Contacts on next login).
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const JAKUB_PROFILE_ID = 3251178998n;
const JAKUB_CONTACT_ID = 2911468032n;

console.log("Before migration:");
console.log(await sql`SELECT
  (SELECT COUNT(*) FROM contacts) AS contacts,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM attempts WHERE contact_id = ${JAKUB_PROFILE_ID}) AS jakub_attempts_old_id,
  (SELECT COUNT(*) FROM attempts WHERE contact_id = ${JAKUB_CONTACT_ID}) AS jakub_attempts_new_id,
  (SELECT COUNT(*) FROM certificates WHERE contact_id = ${JAKUB_PROFILE_ID}) AS jakub_certs_old_id,
  (SELECT COUNT(*) FROM certificates WHERE contact_id = ${JAKUB_CONTACT_ID}) AS jakub_certs_new_id
`);

console.log("\nMigrating ...");

const a = await sql`UPDATE attempts SET contact_id = ${JAKUB_CONTACT_ID} WHERE contact_id = ${JAKUB_PROFILE_ID} RETURNING id`;
console.log(`  remapped ${a.length} attempts to Jakub's Contact id`);

const c = await sql`UPDATE certificates SET contact_id = ${JAKUB_CONTACT_ID} WHERE contact_id = ${JAKUB_PROFILE_ID} RETURNING id`;
console.log(`  remapped ${c.length} certificates to Jakub's Contact id`);

const s = await sql`DELETE FROM sessions RETURNING id`;
console.log(`  cleared ${s.length} sessions`);

const m = await sql`DELETE FROM contacts RETURNING podio_item_id`;
console.log(`  cleared ${m.length} contacts mirror rows`);

console.log("\nAfter migration:");
console.log(await sql`SELECT
  (SELECT COUNT(*) FROM contacts) AS contacts,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM attempts WHERE contact_id = ${JAKUB_CONTACT_ID}) AS jakub_attempts_new_id,
  (SELECT COUNT(*) FROM certificates WHERE contact_id = ${JAKUB_CONTACT_ID}) AS jakub_certs_new_id
`);
