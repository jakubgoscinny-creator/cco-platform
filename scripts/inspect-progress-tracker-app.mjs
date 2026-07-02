#!/usr/bin/env node
// CCO-T033 (read-only, snapshot-and-done): learn the Progress Tracker app
// (16163523) field structure so we can read a Contact's enrolled tracker
// types for Student-tier gating. Writes snapshots/progress-tracker-app.json.
//   Run: node --env-file=.env.local scripts/inspect-progress-tracker-app.mjs
import { writeFileSync } from "node:fs";

const PODIO_API = "https://api.podio.com";
const APP = 16163523; // Progress Tracker (space: -Course Management)
const CONTACTS_APP = 14660191;

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

const token = await getToken();
const auth = { Authorization: `Bearer ${token}` };

// 1) App structure
const appRes = await fetch(`${PODIO_API}/app/${APP}`, { headers: auth });
if (!appRes.ok) throw new Error(`app ${appRes.status}: ${await appRes.text()}`);
const app = await appRes.json();

console.log(`\n===== Progress Tracker app ${APP} (${app.config?.name}) =====`);
console.log(`item_name: ${app.config?.item_name} | fields: ${app.fields?.length}`);
const fieldSummary = [];
for (const f of app.fields ?? []) {
  const s = f.config?.settings ?? {};
  let detail = "";
  if (f.type === "app") {
    const refs = (s.referenced_apps ?? s.referenceable_types ?? [])
      .map((r) => (typeof r === "object" ? r.app_id ?? r.app?.app_id : r));
    detail = `refs=[${refs.join(",")}]${refs.includes(CONTACTS_APP) ? "  <-- CONTACTS" : ""}`;
  } else if (f.type === "category") {
    detail = `opts=[${(s.options ?? []).filter((o) => o.status === "active").map((o) => o.text).join(", ")}] multiple=${s.multiple}`;
  }
  const row = {
    field_id: f.field_id,
    external_id: f.external_id,
    label: f.label,
    type: f.type,
    status: f.status,
    detail,
  };
  fieldSummary.push(row);
  if (f.status === "active")
    console.log(`  ${f.field_id}  ${f.type.padEnd(11)} ${String(f.external_id).padEnd(28)} ${f.label}  ${detail}`);
}

// 2) One sample item to confirm value shapes (limit 2, recent first)
const itemsRes = await fetch(`${PODIO_API}/item/app/${APP}/filter`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ limit: 2 }),
});
const items = itemsRes.ok ? (await itemsRes.json()).items ?? [] : [];
console.log(`\n--- sample items (${items.length}) ---`);
const sample = [];
for (const it of items) {
  const fields = (it.fields ?? []).map((f) => ({
    field_id: f.field_id,
    external_id: f.external_id,
    label: f.label,
    type: f.type,
    value0: JSON.stringify(f.values?.[0]?.value ?? f.values?.[0] ?? null).slice(0, 160),
  }));
  sample.push({ item_id: it.item_id, title: it.title, fields });
  console.log(`\n  item ${it.item_id} — ${it.title}`);
  for (const f of fields) console.log(`    ${f.field_id} ${String(f.type).padEnd(10)} ${String(f.label).padEnd(24)} = ${f.value0}`);
}

writeFileSync(
  "snapshots/progress-tracker-app.json",
  JSON.stringify({ app_id: APP, name: app.config?.name, fields: fieldSummary, sample }, null, 2)
);
console.log("\nSnapshot written: snapshots/progress-tracker-app.json");
