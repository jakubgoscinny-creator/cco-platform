#!/usr/bin/env node
// CCO-T056 (read-only): snapshot the 5 money/access Podio app schemas + 2 sample
// items each, so the ultracode run can resolve flow field-IDs from disk without
// hammering the Podio API across many parallel agents.
//   Run from cco-platform/:  node --env-file=.env.local scripts/dump-money-app-schemas.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const PODIO_API = "https://api.podio.com";
const OUT_DIR = "../flows/schemas";
const APPS = [
  { name: "all_orders", id: 16274502 },
  { name: "circle_webhook", id: 30441980 },
  { name: "contacts", id: 14660191 },
  { name: "progress_tracker", id: 16163523 },
  { name: "student_invitations_processing", id: 17122975 },
];

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

function summariseFields(app) {
  return (app.fields ?? []).map((f) => {
    const s = f.config?.settings ?? {};
    let detail = "";
    if (f.type === "app") {
      const refs = (s.referenced_apps ?? s.referenceable_types ?? [])
        .map((r) => (typeof r === "object" ? r.app_id ?? r.app?.app_id : r));
      detail = `refs=[${refs.join(",")}]`;
    } else if (f.type === "category") {
      detail = `opts=[${(s.options ?? []).filter((o) => o.status === "active").map((o) => `${o.id}:${o.text}`).join(" | ")}] multiple=${s.multiple}`;
    } else if (f.type === "calculation") {
      detail = "calc";
    }
    return {
      field_id: f.field_id,
      external_id: f.external_id,
      label: f.label,
      type: f.type,
      status: f.status,
      detail,
    };
  });
}

const token = await getToken();
const auth = { Authorization: `Bearer ${token}` };
mkdirSync(OUT_DIR, { recursive: true });

for (const { name, id } of APPS) {
  const appRes = await fetch(`${PODIO_API}/app/${id}`, { headers: auth });
  if (!appRes.ok) {
    console.log(`SKIP ${name} (${id}): app ${appRes.status} ${await appRes.text()}`);
    continue;
  }
  const app = await appRes.json();
  const fields = summariseFields(app);

  const itemsRes = await fetch(`${PODIO_API}/item/app/${id}/filter`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 2 }),
  });
  const items = itemsRes.ok ? (await itemsRes.json()).items ?? [] : [];
  const sample = items.map((it) => ({
    item_id: it.item_id,
    title: it.title,
    fields: (it.fields ?? []).map((f) => ({
      field_id: f.field_id,
      external_id: f.external_id,
      label: f.label,
      type: f.type,
      value0: JSON.stringify(f.values?.[0]?.value ?? f.values?.[0] ?? null).slice(0, 200),
    })),
  }));

  const out = `${OUT_DIR}/${name}-app.json`;
  writeFileSync(out, JSON.stringify({ app_id: id, name: app.config?.name, item_name: app.config?.item_name, field_count: fields.length, fields, sample }, null, 2));
  console.log(`${name} (${id}) -> ${out}  [${fields.length} fields, ${sample.length} sample items]`);
}
console.log("done");
