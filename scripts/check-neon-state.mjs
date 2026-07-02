#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const counts = await sql`
  SELECT
    (SELECT COUNT(*) FROM contacts) AS contacts,
    (SELECT COUNT(*) FROM sessions) AS sessions,
    (SELECT COUNT(*) FROM attempts) AS attempts,
    (SELECT COUNT(*) FROM answers) AS answers,
    (SELECT COUNT(*) FROM certificates) AS certificates,
    (SELECT COUNT(*) FROM feedback) AS feedback
`;
console.log("Row counts:", counts[0]);

console.log("\nContacts table sample (currently storing Profile records):");
const c = await sql`SELECT podio_item_id, email, full_name, synced_at FROM contacts LIMIT 5`;
console.table(c);

console.log("\nAttempts:");
const a = await sql`SELECT id, contact_id, test_podio_id, status, score_percent, started_at FROM attempts ORDER BY id DESC LIMIT 10`;
console.table(a);

console.log("\nCertificates:");
const ce = await sql`SELECT id, contact_id, test_podio_id, type, verification_code, issued_at FROM certificates ORDER BY id DESC LIMIT 10`;
console.table(ce);
