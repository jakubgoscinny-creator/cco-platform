#!/usr/bin/env node
// CCO-T034 backfill: replicate any *submitted* attempts that never landed in
// the Podio Test Results app (16234798) — e.g. the submit-time Podio write hit
// the rate-limit cap or an outage. Safe to re-run; idempotent via
// attempts.podio_test_result_item_id.
//
//   Run: node --env-file=.env scripts/backfill-test-results.mjs
//
// NOTE: the field map below MUST stay in sync with the canonical mapper in
// src/lib/test-results-write.ts (mapTestResultFields) — which is unit-tested.
import { neon } from "@neondatabase/serverless";

const PODIO_API = "https://api.podio.com";
const TEST_RESULTS_APP = 16234798;
const TEST_SOURCE_CCO_PORTAL = 5;

const sql = neon(process.env.DATABASE_URL);

async function getAccessToken() {
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
  if (!res.ok)
    throw new Error(`Podio auth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

function splitName(fullName) {
  const name = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { first: "", last: "" };
  const idx = name.indexOf(" ");
  if (idx === -1) return { first: name, last: "" };
  return { first: name.slice(0, idx), last: name.slice(idx + 1) };
}

function mapFields({
  email,
  fullName,
  testName,
  testAppItemId,
  scorePercent,
  durationSeconds,
  completedAt,
  attemptId,
}) {
  const { first, last } = splitName(fullName);
  const fields = {
    125911826: [{ value: email, type: "work" }], // result__email
    147831161: String(attemptId), // result__ID — drives the View Results link
    125911831: scorePercent, // result__percentage
    125911832: Math.max(0, Math.round(durationSeconds)), // result__duration (seconds)
    125911836: testName, // test__test_name (flow 20 match key)
    125935780: { start: new Date(completedAt).toISOString().slice(0, 10) + " 00:00:00" }, // Date Taken (Podio needs full datetime even for date-only)
    146183536: TEST_SOURCE_CCO_PORTAL, // Test Source
    159495002: `Created by CCO Portal backfill (attempt ${attemptId})`, // Debugging Trace
    202661666: 1, // Processing Status = Active
    149821869: 1, // ACTION 1 Contact = Not Processed
    133039300: 1, // ACTION 2 Test & PT = Not Processed
    171918764: 1, // ACTION 3 Commentary = Not Done
    184537890: 1, // ACTION 4 Complete Chapter = Not Done
    215264813: 1, // ACTION 5 Notify Coach = Not Done
    136038030: 2, // Auto Results Email = Not Sent
  };
  if (first) fields[125913230] = first; // result__first
  if (last) fields[125911818] = last; // result__last
  if (testAppItemId != null) fields[125913681] = `test${testAppItemId}`; // test__test_id
  return fields;
}

async function getAppItemId(token, itemId) {
  const res = await fetch(`${PODIO_API}/item/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()).app_item_id ?? null;
}

// Optional single-attempt mode: `node ... backfill-test-results.mjs <attemptId>`
// — used for the one-row sandbox smoke before a full backfill.
const onlyId = process.argv[2] ? Number(process.argv[2]) : null;

const allRows = await sql`
  SELECT a.id, a.test_podio_id, a.started_at, a.submitted_at, a.score_percent,
         c.email, c.full_name, t.test_name
  FROM attempts a
  JOIN contacts c ON c.podio_item_id = a.contact_id
  JOIN tests t    ON t.podio_item_id = a.test_podio_id
  WHERE a.status = 'submitted' AND a.podio_test_result_item_id IS NULL
  ORDER BY a.submitted_at ASC NULLS LAST
`;

const rows = onlyId ? allRows.filter((r) => r.id === onlyId) : allRows;

if (onlyId) console.log(`Single-attempt mode: attempt #${onlyId}`);
console.log(`Backfill candidates: ${rows.length}`);
if (!rows.length) process.exit(0);

const token = await getAccessToken();
let ok = 0;
let failed = 0;

for (const r of rows) {
  const durationSeconds =
    r.started_at && r.submitted_at
      ? Math.max(
          0,
          Math.round((new Date(r.submitted_at) - new Date(r.started_at)) / 1000)
        )
      : 0;

  const fields = mapFields({
    email: r.email,
    fullName: r.full_name,
    testName: r.test_name,
    testAppItemId: await getAppItemId(token, r.test_podio_id),
    scorePercent: Number(r.score_percent ?? 0),
    durationSeconds,
    completedAt: r.submitted_at ?? new Date(),
    attemptId: r.id,
  });

  const res = await fetch(`${PODIO_API}/item/app/${TEST_RESULTS_APP}/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    failed++;
    console.error(`  attempt ${r.id}: FAILED (${res.status}) ${await res.text()}`);
    if (res.status === 420) {
      console.error("  Rate-limit cap hit — stopping; re-run later.");
      break;
    }
    continue;
  }

  const { item_id } = await res.json();
  await sql`UPDATE attempts SET podio_test_result_item_id = ${item_id} WHERE id = ${r.id}`;
  ok++;
  console.log(`  attempt ${r.id} -> Test Results item ${item_id}`);
}

console.log(`Done. ${ok} written, ${failed} failed.`);
