#!/usr/bin/env node
// CCO-T044 (read-only): compare the CURRENT portal-visibility source
// (Test Status = "Active - In Portal", field 125981847 opt 19) against the
// NEW one agreed in the 2026-05-28 meeting (Ready for Portal = Yes, field
// 276781364 opt 1). Confirms the catalog won't empty when we flip the source.
//   Run: node --env-file=.env.local scripts/inspect-ready-for-portal.mjs
const PODIO_API = "https://api.podio.com";
const TESTS = 16243239;
const F_STATUS = 125981847;        // Test Status; "Active - In Portal" = opt 19
const F_READY = 276781364;         // Ready for Portal; Yes = opt 1

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
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function filterBy(filters) {
  const res = await fetch(`${PODIO_API}/item/app/${TESTS}/filter`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ filters, limit: 100 }),
  });
  if (!res.ok) throw new Error(`filter ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { total: j.filtered, items: j.items ?? [] };
}

const active = await filterBy({ [F_STATUS]: [19] });
const ready = await filterBy({ [F_READY]: [1] });

const idsOf = (r) => new Set(r.items.map((i) => i.item_id));
const nameOf = (i) => i.title;
const activeIds = idsOf(active);
const readyIds = idsOf(ready);

const inActiveNotReady = active.items.filter((i) => !readyIds.has(i.item_id));
const inReadyNotActive = ready.items.filter((i) => !activeIds.has(i.item_id));

console.log(`Active - In Portal (current source): total=${active.total}, fetched=${active.items.length}`);
console.log(`Ready for Portal = Yes (new source):  total=${ready.total}, fetched=${ready.items.length}`);
console.log(`\nIn Active-In-Portal but NOT Ready-for-Portal (would DISAPPEAR after flip): ${inActiveNotReady.length}`);
for (const i of inActiveNotReady) console.log(`  - [${i.item_id}] ${nameOf(i)}`);
console.log(`\nIn Ready-for-Portal but NOT Active-In-Portal (would APPEAR after flip): ${inReadyNotActive.length}`);
for (const i of inReadyNotActive) console.log(`  + [${i.item_id}] ${nameOf(i)}`);
