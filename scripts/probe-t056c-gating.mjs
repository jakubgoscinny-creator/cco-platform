#!/usr/bin/env node
// CCO-T056c (read-only): behavioural proof of the status-aware Student resolver
// on LIVE Podio data, login-free. Mirrors the deployed logic:
//   old = collect tracker types from ALL the contact's PTs
//   new = exclude PTs whose Overall Status is a teardown id {5,11,12,14}
//   Run from cco-platform/:  node --env-file=.env.local scripts/probe-t056c-gating.mjs
const PODIO_API = "https://api.podio.com";
const PT_APP = 16163523;
const F = { STUDENT: 125306242, TYPE: 128205285, STATUS: 149529784 };
const TEARDOWN = new Set([5, 11, 12, 14]);
const RENEE_CONTACT = 3275345593;

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

async function filter(body) {
  const r = await fetch(`${PODIO_API}/item/app/${PT_APP}/filter/`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`filter ${r.status}: ${await r.text()}`);
  return r.json();
}
const fieldVal = (it, fid) => (it.fields ?? []).find((f) => f.field_id === fid)?.values?.[0]?.value;
const typeText = (it) => fieldVal(it, F.TYPE)?.text ?? null;
const statusId = (it) => { const v = fieldVal(it, F.STATUS); return v && typeof v === "object" ? Number(v.id) : null; };
const statusText = (it) => fieldVal(it, F.STATUS)?.text ?? "(none)";

function resolve(items) {
  const oldT = new Set(), newT = new Set();
  for (const it of items) {
    const t = typeText(it); if (!t) continue;
    oldT.add(t);
    if (!TEARDOWN.has(statusId(it))) newT.add(t); // null/unknown -> kept (fail-open)
  }
  return { old: [...oldT], neu: [...newT] };
}

// 1) Prove the change HAS effect: find PTs in a teardown status.
const td = await filter({ filters: { [F.STATUS]: [...TEARDOWN] }, limit: 5 });
console.log(`\nPTs currently in a teardown status (${F.STATUS} in {5,11,12,14}): ${td.filtered} total`);
for (const it of td.items ?? []) {
  const student = fieldVal(it, F.STUDENT);
  console.log(`  PT ${it.item_id} | type=${typeText(it)} | status=${statusText(it)} | student=${student?.item_id ?? student?.value?.item_id ?? "?"}`);
}

// 2) Pick the first teardown PT's student; show old vs new resolver for them.
const firstStudent = (() => {
  for (const it of td.items ?? []) {
    const s = fieldVal(it, F.STUDENT);
    const id = s?.item_id ?? s?.value?.item_id;
    if (id) return id;
  }
  return null;
})();
if (firstStudent) {
  const all = await filter({ filters: { [F.STUDENT]: [firstStudent] }, limit: 200 });
  const r = resolve(all.items ?? []);
  const removed = r.old.filter((t) => !r.neu.includes(t));
  console.log(`\nAffected student contact ${firstStudent}: ${all.items?.length} PTs`);
  console.log(`  OLD (all PTs)        -> [${r.old.join(", ")}]`);
  console.log(`  NEW (status-aware)   -> [${r.neu.join(", ")}]`);
  console.log(`  REMOVED by T056c     -> [${removed.join(", ") || "(none)"}]`);
}

// 3) Renee (active canonical test account): expect old === new (unaffected).
const renee = await filter({ filters: { [F.STUDENT]: [RENEE_CONTACT] }, limit: 200 });
const rr = resolve(renee.items ?? []);
console.log(`\nRenee (active, contact ${RENEE_CONTACT}): ${renee.items?.length} PTs`);
console.log(`  OLD -> [${rr.old.join(", ")}] | NEW -> [${rr.neu.join(", ")}] | unchanged=${JSON.stringify(rr.old) === JSON.stringify(rr.neu)}`);

// 4) An ACTIVE-status student: confirm their tracker type is RETAINED.
const act = await filter({ filters: { [F.STATUS]: [1] }, limit: 1 }); // 1 = Enrolled - Active
const as = act.items?.[0] ? fieldVal(act.items[0], F.STUDENT) : null;
const asId = as?.item_id ?? as?.value?.item_id;
if (asId) {
  const all = await filter({ filters: { [F.STUDENT]: [asId] }, limit: 200 });
  const r = resolve(all.items ?? []);
  const kept = r.old.filter((t) => r.neu.includes(t));
  console.log(`\nActive-status student contact ${asId}: ${all.items?.length} PTs`);
  console.log(`  OLD -> [${r.old.join(", ")}] | NEW -> [${r.neu.join(", ")}] | retained=[${kept.join(", ")}]`);
}
console.log("\ndone");
