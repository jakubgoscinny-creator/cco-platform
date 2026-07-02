#!/usr/bin/env node
// CCO-T085 (read-only): pull real recent Test Results rows with no Progress
// Tracker Type set, to show Jakub concrete examples rather than just theory.
// Run: node --env-file=.env.local scripts/probe-t085-pt-type-examples.mjs
const PODIO_API = "https://api.podio.com";
const TEST_RESULTS_APP = 16234798;
const F = {
  DATE_TAKEN: 125935780,
  TEST_NAME: 125911836,
  TEST_SOURCE: 146183536,
  PT_TYPE: 128205567,
  EXAM_LOOKUP: 142217973, // app ref -> Tests (set once flow 20 has matched)
  RESULT_PERCENTAGE: 125911831,
};
const TEST_SOURCE_LABEL = { 1: "ClassMarker", 2: "ProProfs", 3: "CM_DEV", 4: "Xenforo", 5: "CCO Portal" };

async function token() {
  const r = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error(`auth ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}
const auth = { Authorization: `Bearer ${await token()}` };
const val = (it, fid) => (it.fields ?? []).find((f) => f.field_id === fid)?.values?.[0]?.value;

// Sample the most recent 300 Test Results rows.
let offset = 0;
const rows = [];
while (offset < 300) {
  const r = await fetch(`${PODIO_API}/item/app/${TEST_RESULTS_APP}/filter/`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100, offset, sort_by: "created_on", sort_desc: true }),
  });
  const { items } = await r.json();
  rows.push(...items);
  if (items.length < 100) break;
  offset += 100;
}
console.log(`Sampled ${rows.length} most-recent Test Results rows.`);

const noPtType = rows.filter((it) => !val(it, F.PT_TYPE));
console.log(`${noPtType.length}/${rows.length} have no Progress Tracker Type set.\n`);

for (const it of noPtType.slice(0, 15)) {
  const source = val(it, F.TEST_SOURCE);
  const examLookup = val(it, F.EXAM_LOOKUP);
  console.log(`item_id ${it.item_id} (app_item_id ${it.app_item_id})`);
  console.log(`  created_on:      ${it.created_on}`);
  console.log(`  date_taken:      ${JSON.stringify(val(it, F.DATE_TAKEN))}`);
  console.log(`  test_name (raw): ${val(it, F.TEST_NAME)}`);
  console.log(`  test_source:     ${source ? `${TEST_SOURCE_LABEL[source.id] ?? source.id}` : "(none)"}`);
  console.log(`  score:           ${val(it, F.RESULT_PERCENTAGE)}`);
  console.log(`  exam_lookup:     ${examLookup ? JSON.stringify(examLookup) : "(EMPTY — flow 20 never matched a Test)"}`);
  console.log("");
}

// Break down by source + whether exam_lookup resolved, to spot the pattern.
const bySource = {};
for (const it of noPtType) {
  const source = val(it, F.TEST_SOURCE);
  const label = source ? (TEST_SOURCE_LABEL[source.id] ?? String(source.id)) : "(none)";
  const hasLookup = !!val(it, F.EXAM_LOOKUP);
  const key = `${label} / examLookup=${hasLookup ? "resolved" : "EMPTY"}`;
  bySource[key] = (bySource[key] ?? 0) + 1;
}
console.log("Breakdown of no-PT-Type rows by source + whether flow 20's Exam Lookup resolved:");
console.log(JSON.stringify(bySource, null, 2));
