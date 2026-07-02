#!/usr/bin/env node
// CCO-T034: set the editable id fields the View Results calc + record-matching
// need on existing portal-created Test Results rows:
//   result__ID (147831161)   = attempt id           -> View Results link
//   test__test_id (125913681) = "test{appItemId}"   -> matches Zenforo rows
// Both are editable text fields (NOT the calc). Idempotent.
//   Run: node --env-file=.env --env-file=.env.local scripts/set-result-ids.mjs
import { neon } from "@neondatabase/serverless";

const PODIO_API = "https://api.podio.com";
const RESULT_ID = 147831161;
const TEST_ID = 125913681;
const sql = neon(process.env.DATABASE_URL);

async function getToken() {
  const res = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function appItemId(token, itemId) {
  const res = await fetch(`${PODIO_API}/item/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()).app_item_id ?? null;
}

const rows = await sql`
  SELECT id, podio_test_result_item_id AS item_id, test_podio_id
  FROM attempts
  WHERE podio_test_result_item_id IS NOT NULL
  ORDER BY id ASC
`;
console.log(`Portal Test Results rows to update: ${rows.length}`);
if (!rows.length) process.exit(0);

const token = await getToken();
for (const r of rows) {
  const fields = { [RESULT_ID]: String(r.id) };
  const aid = await appItemId(token, r.test_podio_id);
  if (aid != null) fields[TEST_ID] = `test${aid}`;

  const res = await fetch(`${PODIO_API}/item/${r.item_id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    console.error(`  attempt ${r.id} (item ${r.item_id}): FAILED ${res.status} ${await res.text()}`);
    continue;
  }
  console.log(`  attempt ${r.id} -> item ${r.item_id}: result__ID="${r.id}", test__test_id=${aid != null ? `"test${aid}"` : "(skipped)"}`);
}
console.log("Done.");
