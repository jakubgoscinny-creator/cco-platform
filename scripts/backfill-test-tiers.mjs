#!/usr/bin/env node
// CCO-T044 HOTFIX: the Neon tests.access_tier was stale (old sync mapped every
// non-Free test to "Member" → normalizes to Club → visible+unlocked to any
// subscriber). That leaked the 244 Student course exams to club members once
// Ready-for-Portal expanded the catalog. This backfills the CORRECT access_tier
// + student_tracker_type from Podio for the Ready-for-Portal set, so the
// already-deployed gating treats course exams as Student (hidden unless enrolled).
//   Run: node --env-file=.env.local scripts/backfill-test-tiers.mjs
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

const RECOGNIZED = new Set(["Free", "Club", "Club Member", "Student", "Member"]);
const cat = (item, extId) => {
  const f = (item.fields ?? []).find((x) => x.external_id === extId);
  return f?.values?.[0]?.value?.text ?? null;
};

const token = await getToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const sql = neon(process.env.DATABASE_URL);

let offset = 0;
const all = [];
while (true) {
  const res = await fetch(`${PODIO_API}/item/app/${TESTS}/filter`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ filters: { [F_READY]: [1] }, limit: 100, offset }),
  });
  if (!res.ok) throw new Error(`filter ${res.status}: ${await res.text()}`);
  const j = await res.json();
  all.push(...(j.items ?? []));
  if (all.length >= j.filtered || (j.items ?? []).length < 100) break;
  offset += 100;
}

const ids = [];
const tiers = [];
const types = [];
for (const it of all) {
  const rawTier = cat(it, "access-tier");
  const tier = RECOGNIZED.has(rawTier) ? rawTier : "Club"; // fail-closed (never Free)
  const tt = cat(it, "progress-tracker-type-2");
  ids.push(it.item_id);
  tiers.push(tier);
  types.push(tt && tt !== "NA" ? tt : null);
}

// One pass via unnest — set the correct tier + tracker type for the visible set.
await sql`
  UPDATE tests AS t SET
    access_tier = u.tier,
    student_tracker_type = u.tt
  FROM unnest(${ids}::bigint[], ${tiers}::text[], ${types}::text[]) AS u(id, tier, tt)
  WHERE t.podio_item_id = u.id
`;

const tally = await sql`
  SELECT access_tier, count(*)::int AS n
  FROM tests WHERE ready_for_portal GROUP BY access_tier ORDER BY n DESC
`;
console.log(`Backfilled ${ids.length} Ready-for-Portal tests. Neon access_tier tally (visible set):`);
for (const r of tally) console.log(`  ${String(r.access_tier).padEnd(12)} ${r.n}`);
const stud = await sql`SELECT count(*)::int AS n FROM tests WHERE ready_for_portal AND access_tier='Student' AND student_tracker_type IS NOT NULL`;
console.log(`Student-tier with a tracker type set: ${stud[0].n}`);
