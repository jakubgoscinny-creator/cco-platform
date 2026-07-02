#!/usr/bin/env node
// CCO-T044: portal visibility driven by "Ready for Portal" = Yes (field
// 276781364), replacing Test Status = "Active - In Portal". Adds the column
// AND backfills it from Podio so the catalog is populated before the new code
// deploys (no empty-catalog window). The deployed app's normal test sync keeps
// it fresh thereafter (mapPodioTest now writes ready_for_portal).
//   Run: node --env-file=.env.local scripts/apply-t043-ready-for-portal.mjs
import { neon } from "@neondatabase/serverless";

const PODIO_API = "https://api.podio.com";
const TESTS = 16243239;
const F_READY = 276781364; // Ready for Portal; Yes = opt 1

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

const sql = neon(process.env.DATABASE_URL);

// 1) migrate (idempotent)
await sql`ALTER TABLE tests ADD COLUMN IF NOT EXISTS ready_for_portal boolean NOT NULL DEFAULT false`;
console.log("CCO-T044 migration applied: tests.ready_for_portal");

// 2) backfill from Podio (Ready for Portal = Yes)
const token = await getToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
let offset = 0;
const ids = [];
while (true) {
  const res = await fetch(`${PODIO_API}/item/app/${TESTS}/filter`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ filters: { [F_READY]: [1] }, limit: 100, offset }),
  });
  if (!res.ok) throw new Error(`filter ${res.status}: ${await res.text()}`);
  const j = await res.json();
  for (const it of j.items ?? []) ids.push(it.item_id);
  if (ids.length >= j.filtered || (j.items ?? []).length < 100) break;
  offset += 100;
}

// One pass: true for the Ready set, false for everything else (re-runnable).
await sql`UPDATE tests SET ready_for_portal = (podio_item_id = ANY(${ids}::bigint[]))`;
const r = await sql`SELECT count(*)::int AS n FROM tests WHERE ready_for_portal`;
console.log(`Backfill: ${ids.length} Ready-for-Portal ids from Podio; ${r[0].n} Neon rows now ready_for_portal=true`);
