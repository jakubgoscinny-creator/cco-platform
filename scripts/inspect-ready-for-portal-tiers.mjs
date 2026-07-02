#!/usr/bin/env node
// CCO-T044 (read-only): tally the tier-tagging state of the Ready-for-Portal
// test set. This decides whether flipping the catalog source is SAFE: untagged
// tests fall back to Club, which would LEAK course exams to club subscribers.
//   Run: node --env-file=.env.local scripts/inspect-ready-for-portal-tiers.mjs
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

const token = await getToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const cat = (item, extId) => {
  const f = (item.fields ?? []).find((x) => x.external_id === extId);
  return f?.values?.[0]?.value?.text ?? null;
};

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

const tierTally = {};
let studentMissingType = 0;
const studentMissingSample = [];
for (const it of all) {
  const tier = cat(it, "access-tier") ?? "(untagged)";
  tierTally[tier] = (tierTally[tier] ?? 0) + 1;
  if (tier === "Student") {
    const tt = cat(it, "progress-tracker-type-2");
    if (!tt || tt === "NA") {
      studentMissingType++;
      if (studentMissingSample.length < 10) studentMissingSample.push(it.title);
    }
  }
}

console.log(`Ready-for-Portal tests scanned: ${all.length}`);
console.log(`\naccess_tier tally:`);
for (const [k, v] of Object.entries(tierTally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(k).padEnd(12)} ${v}`);
}
const untagged = tierTally["(untagged)"] ?? 0;
const club = tierTally["Club"] ?? 0;
const member = tierTally["Member"] ?? 0;
console.log(`\nWould be UNLOCKED to a club subscriber via fallback today (untagged+Member+Club): ${untagged + member + club}`);
console.log(`Student-tier tests MISSING a tracker type (admin error → stay locked): ${studentMissingType}`);
for (const n of studentMissingSample) console.log(`  ! ${n}`);
