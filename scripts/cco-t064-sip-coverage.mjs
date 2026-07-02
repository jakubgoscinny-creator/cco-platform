// CCO-T064 item 3 — SIP coverage audit (READ-ONLY). No writes.
// For each active Stripe subscriber that can be joined (has community_member_id),
// resolve Contact (14660191.272609487) then check SIP (17122975) presence/active.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTACTS_APP = 14660191, CONTACT_CIRCLE_MEMBER_ID = 272609487;
const SIP_APP = 17122975, SIP_CONTACT_FIELD = 133632962, SIP_STATUS_FIELD = 199828123;
const CAP = 45, THROTTLE_MS = 250;
// SIP Status option ids treated as "torn down / inactive" — from CCO-T056 teardown set; we infer
// active = anything else. We print the distribution so the labels can be confirmed.

function loadEnv() {
  const p = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
    let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
let token = null;
async function podioToken() {
  if (token) return token;
  const res = await fetch("https://api.podio.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.PODIO_REFRESH_TOKEN, client_id: process.env.PODIO_CLIENT_ID, client_secret: process.env.PODIO_CLIENT_SECRET }) });
  if (!res.ok) throw new Error(`auth ${res.status}`); token = (await res.json()).access_token; return token;
}
async function podio(p, opts = {}) {
  const t = await podioToken();
  const res = await fetch(`https://api.podio.com${p}`, { ...opts, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (res.status === 420) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`${p} ${res.status}: ${(await res.text()).slice(0,120)}`);
  return res.json();
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function fieldVals(item, fid) { const f = (item.fields || []).find(x => x.field_id === fid); return f ? f.values : null; }

async function main() {
  loadEnv();
  const subs = JSON.parse(fs.readFileSync(path.join(__dirname, "_stripe_active_subs.json"), "utf8"));
  const joinable = subs.filter(s => s.cmid).slice(0, CAP);
  console.log(`Active subs in file: ${subs.length}; with community_member_id: ${subs.filter(s=>s.cmid).length}; sampling ${joinable.length}`);

  let contactFound = 0, contactMissing = 0, zeroSip = 0, hasActiveSip = 0, onlyTorndownSip = 0;
  const statusDist = {};
  const gaps = [];

  for (const s of joinable) {
    await sleep(THROTTLE_MS);
    let cres;
    try {
      cres = await podio(`/item/app/${CONTACTS_APP}/filter/`, { method: "POST", body: JSON.stringify({ filters: { [CONTACT_CIRCLE_MEMBER_ID]: String(s.cmid) }, limit: 2 }) });
    } catch (e) { console.log(`  contact lookup err cmid=${s.cmid}: ${e.message}`); contactMissing++; continue; }
    if (!cres.items.length) { contactMissing++; gaps.push({ cmid: s.cmid, pw: s.pw, reason: "no Contact for community_member_id" }); continue; }
    contactFound++;
    const contactId = cres.items[0].item_id;
    await sleep(THROTTLE_MS);
    let sres;
    try {
      sres = await podio(`/item/app/${SIP_APP}/filter/`, { method: "POST", body: JSON.stringify({ filters: { [SIP_CONTACT_FIELD]: [contactId] }, limit: 100 }) });
    } catch (e) { console.log(`  sip lookup err contact=${contactId}: ${e.message}`); continue; }
    if (!sres.items.length) { zeroSip++; gaps.push({ cmid: s.cmid, pw: s.pw, contactId, reason: "Contact has ZERO SIP items" }); continue; }
    let anyActive = false;
    for (const it of sres.items) {
      const v = fieldVals(it, SIP_STATUS_FIELD);
      const label = v && v[0] ? (v[0].value?.text ?? "?") : "(none)";
      statusDist[label] = (statusDist[label] || 0) + 1;
      const torn = /suspend|remove|delet|lapse|expire|cancel|inactive/i.test(label);
      if (!torn && label !== "(none)") anyActive = true;
    }
    if (anyActive) hasActiveSip++; else { onlyTorndownSip++; gaps.push({ cmid: s.cmid, pw: s.pw, contactId, reason: "Contact has SIPs but none active" }); }
  }

  console.log(`\n=== ITEM 3 (sample of ${joinable.length} join-able active subscribers) ===`);
  console.log(`Contact resolved: ${contactFound}; Contact NOT found by member id: ${contactMissing}`);
  console.log(`  of resolved: >=1 ACTIVE SIP: ${hasActiveSip}; SIPs but none active: ${onlyTorndownSip}; ZERO SIPs: ${zeroSip}`);
  console.log(`SIP Status label distribution (across sampled contacts' SIPs):`, JSON.stringify(statusDist, null, 0));
  console.log(`\n--- concrete coverage gaps (active Stripe sub but teardown would find no active SIP) ---`);
  if (!gaps.length) console.log("  (none in sample) ✅");
  for (const g of gaps) console.log(`  cmid=${g.cmid} paywall=${g.pw} ${g.contactId?`contact=${g.contactId} `:""}-> ${g.reason}`);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
