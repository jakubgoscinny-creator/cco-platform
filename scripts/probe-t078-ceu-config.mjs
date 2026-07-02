#!/usr/bin/env node
// CCO-T078 (read-only): check CEU item 1271's config + find which Test item(s)
// (if any) link to it via TEST_FIELDS.CEU_ITEMS, and compare against a known-
// working CEU test for contrast.
// Run: node --env-file=.env.local scripts/probe-t078-ceu-config.mjs
const PODIO_API = "https://api.podio.com";
const TESTS_APP = 16243239;
const CEU_ITEMS_APP = 14639788;
const CEU_ITEMS_FIELD = 137578199; // TEST_FIELDS.CEU_ITEMS on Tests app
const CEU_RELATED_TEST_FIELD = null; // will discover from item payload

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

// 1. Fetch CEU item 1271 by app_item_id.
const ceuR = await fetch(`${PODIO_API}/app/${CEU_ITEMS_APP}/item/1271`, { headers: auth });
if (!ceuR.ok) {
  console.log("CEU item 1271 fetch failed:", ceuR.status, await ceuR.text());
  process.exit(1);
}
const ceu = await ceuR.json();
console.log(`=== CEU item 1271 (item_id ${ceu.item_id}) ===`);
console.log("title:", ceu.fields?.find((f) => f.external_id === "title" || f.type === "text")?.values?.[0]?.value);
console.log("files:", (ceu.files ?? []).map((f) => `${f.name} (${f.mimetype})`));
for (const f of ceu.fields ?? []) {
  console.log(`  field ${f.field_id} [${f.external_id}] (${f.type}):`, JSON.stringify(f.values).slice(0, 200));
}

// 2. Search Tests app for any item whose CEU_ITEMS field references this CEU item's item_id.
console.log("\n=== Searching Tests app for links to CEU item", ceu.item_id, "===");
let offset = 0;
const linkedTests = [];
while (true) {
  const r = await fetch(`${PODIO_API}/item/app/${TESTS_APP}/filter/`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100, offset }),
  });
  const { items, filtered } = await r.json();
  for (const it of items) {
    const ceuField = (it.fields ?? []).find((f) => f.field_id === CEU_ITEMS_FIELD);
    const refs = (ceuField?.values ?? []).map((v) => v.value?.item_id);
    if (refs.includes(ceu.item_id)) linkedTests.push(it);
  }
  offset += 100;
  if (offset >= filtered) break;
}
console.log(`Tests linking to CEU item 1271:`, linkedTests.map((t) => ({
  item_id: t.item_id,
  app_item_id: t.app_item_id,
  name: t.fields?.find((f) => f.field_id === 125981694)?.values?.[0]?.value,
})));
