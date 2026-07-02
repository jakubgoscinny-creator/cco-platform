#!/usr/bin/env node
// CCO-T034: compare Test Results items (by app_item_id) — focus on the fields
// that drive the "View Results" links.
//   Run: node --env-file=.env --env-file=.env.local scripts/compare-test-results.mjs 127331 127329
const PODIO_API = "https://api.podio.com";
const APP = 16234798;

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

async function getByAppItemId(token, appItemId) {
  const res = await fetch(`${PODIO_API}/app/${APP}/item/${appItemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${appItemId}: ${res.status} ${await res.text()}`);
  return res.json();
}

const FIELDS = {
  "Test Source": 146183536,
  "result__ID": 147831161,
  "test__test_id": 125913681,
  "result__email": 125911826,
  "Exam Lookup": 142217973,
  "Progress Tracker Type": 128205567,
  "View Results | CCO Staff": 125937527,
  "View Results | Students": 150750509,
};

function fieldVal(item, fid) {
  const f = item.fields?.find((f) => f.field_id === fid);
  if (!f) return "(absent)";
  return (f.values ?? [])
    .map((x) => {
      const v = x.value;
      if (v && typeof v === "object") return v.text ?? v.title ?? JSON.stringify(v);
      return v;
    })
    .join(" | ");
}

const token = await getToken();
for (const id of process.argv.slice(2)) {
  const item = await getByAppItemId(token, Number(id));
  console.log(`\n=== app_item ${id} (item_id ${item.item_id}) — ${item.title} ===`);
  for (const [label, fid] of Object.entries(FIELDS)) {
    console.log(`  ${label}: ${fieldVal(item, fid)}`);
  }
}
