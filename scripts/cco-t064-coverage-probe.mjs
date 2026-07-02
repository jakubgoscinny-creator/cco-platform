// CCO-T064 coverage probe — READ-ONLY. No writes to Podio/Neon/Stripe.
// Item 2: Membership Lookup (19819685.273681814) completeness vs every active Stripe paywall.
// Item 3: SIP (17122975) structure discovery (for the coverage audit).
//
// Usage: node scripts/cco-t064-coverage-probe.mjs <stripe_products_page1.json>
//   page1 = the saved GetProducts(limit100,active) result file (tool-results/...txt)
//   page2 = scripts/_stripe_paywalls_p2.json (committed alongside)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMBERSHIP_APP = 19819685;
const MEMBERSHIP_PAYWALL_FIELD = 273681814; // per CCO-T064 design (C1 "contains" match)
const SIP_APP = 17122975;

// ---- load .env.local (Podio creds) ----
function loadEnv() {
  const p = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

let token = null;
async function podioToken() {
  if (token) return token;
  const res = await fetch("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Podio auth failed ${res.status}: ${await res.text()}`);
  token = (await res.json()).access_token;
  return token;
}

async function podio(pathname, opts = {}) {
  const t = await podioToken();
  const res = await fetch(`https://api.podio.com${pathname}`, {
    ...opts,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (res.status === 420) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`Podio ${pathname} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function filterAll(appId, cap = 5000) {
  const out = [];
  let offset = 0;
  for (;;) {
    const body = JSON.stringify({ limit: 100, offset });
    let page;
    for (let attempt = 0; ; attempt++) {
      try { page = await podio(`/item/app/${appId}/filter/`, { method: "POST", body }); break; }
      catch (e) { if (e.message === "RATE_LIMIT" && attempt < 3) { await new Promise(r => setTimeout(r, 65000)); continue; } throw e; }
    }
    out.push(...page.items);
    if (out.length >= page.filtered || page.items.length === 0 || out.length >= cap) {
      return { items: out, total: page.total, filtered: page.filtered };
    }
    offset += 100;
  }
}

function fieldVals(item, fieldId) {
  const f = (item.fields || []).find((x) => x.field_id === fieldId);
  return f ? f.values : null;
}
function digits(s) { return (String(s).match(/\d{5,7}/g) || []); }

function classify(name) {
  const n = name.toLowerCase();
  if (/(fee|reinstat|consulting|retainer|testing|platform fee|administrative)/.test(n)) return "FEE/ADMIN/TEST (no membership expected)";
  return "GRANT-BEARING (course/club/blitz/exam — needs a membership row)";
}

async function main() {
  loadEnv();
  const page1Path = process.argv[2];
  const p1 = JSON.parse(fs.readFileSync(page1Path, "utf8"));
  const p2 = JSON.parse(fs.readFileSync(path.join(__dirname, "_stripe_paywalls_p2.json"), "utf8"));

  const stripe = new Map(); // paywall_id -> name
  for (const pr of p1.data) { const pw = pr.metadata?.paywall_id; if (pw) stripe.set(String(pw), pr.name); }
  for (const r of p2) stripe.set(String(r.paywall_id), r.name);
  console.log(`STRIPE active paywalls: ${stripe.size} (p1=${p1.data.length}, p2=${p2.length}, p1.has_more=${p1.has_more})`);

  // ---- Membership Lookup ----
  console.log(`\n=== Membership Lookup app ${MEMBERSHIP_APP} ===`);
  const mem = await filterAll(MEMBERSHIP_APP);
  console.log(`items: total=${mem.total} filtered=${mem.filtered} fetched=${mem.items.length}`);
  if (mem.items[0]) {
    console.log("SAMPLE item field schema (id | label | type):");
    for (const f of mem.items[0].fields || []) console.log(`  ${f.field_id} | ${f.label} | ${f.type}`);
    const pwf = fieldVals(mem.items[0], MEMBERSHIP_PAYWALL_FIELD);
    console.log(`  -> field ${MEMBERSHIP_PAYWALL_FIELD} raw on sample:`, JSON.stringify(pwf));
  }

  const memPaywalls = new Set();
  let memMissingField = 0;
  for (const it of mem.items) {
    const vals = fieldVals(it, MEMBERSHIP_PAYWALL_FIELD);
    if (!vals) { memMissingField++; continue; }
    for (const v of vals) {
      const raw = v.value?.text ?? v.value ?? v;
      for (const d of digits(raw)) memPaywalls.add(d);
    }
  }
  console.log(`Membership rows w/o field ${MEMBERSHIP_PAYWALL_FIELD}: ${memMissingField}`);
  console.log(`Distinct paywall_ids mapped in Membership: ${memPaywalls.size}`);

  // ---- comparison (Item 2) ----
  const missing = [...stripe.keys()].filter((pw) => !memPaywalls.has(pw));
  const stale = [...memPaywalls].filter((pw) => !stripe.has(pw));

  const missGrant = missing.filter((pw) => classify(stripe.get(pw)).startsWith("GRANT"));
  const missFee = missing.filter((pw) => !classify(stripe.get(pw)).startsWith("GRANT"));

  console.log(`\n=== ITEM 2 RESULT ===`);
  console.log(`Active Stripe paywalls NOT in Membership map: ${missing.length} (grant-bearing=${missGrant.length}, fee/admin=${missFee.length})`);
  console.log(`\n--- GRANT-BEARING paywalls MISSING a membership row (grants would MISS) ---`);
  if (missGrant.length === 0) console.log("  (none) ✅");
  for (const pw of missGrant.sort()) console.log(`  ${pw} | ${stripe.get(pw)}`);
  console.log(`\n--- fee/admin/test paywalls missing a membership row (expected, informational) ---`);
  for (const pw of missFee.sort()) console.log(`  ${pw} | ${stripe.get(pw)}`);
  console.log(`\n--- Membership paywall rows with NO active Stripe paywall (stale/legacy, informational): ${stale.length} ---`);
  for (const pw of stale.sort()) console.log(`  ${pw}`);

  // ---- SIP discovery (Item 3 planning) ----
  console.log(`\n=== SIP app ${SIP_APP} (discovery for item 3) ===`);
  const sipPage = await podio(`/item/app/${SIP_APP}/filter/`, { method: "POST", body: JSON.stringify({ limit: 1, offset: 0 }) });
  console.log(`SIP total=${sipPage.total} filtered=${sipPage.filtered}`);
  if (sipPage.items[0]) {
    console.log("SIP SAMPLE field schema (id | label | type):");
    for (const f of sipPage.items[0].fields || []) console.log(`  ${f.field_id} | ${f.label} | ${f.type}`);
  }
}

main().catch((e) => { console.error("PROBE ERROR:", e.message); process.exit(1); });
