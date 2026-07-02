#!/usr/bin/env node
// CCO-T078 (read-only, no writes): behavioural proof that the new reverse-link
// fallback in getCeuItemsForTest would resolve CEU item 1271 for Test 3034
// ("CCO Club Q&A #1737", item_id 3326365902), mirroring the exact logic added
// to src/lib/sync.ts without importing the TS module directly (no local
// node_modules/ts-runner in this worktree).
const PODIO_API = "https://api.podio.com";
const CEU_ITEMS_APP = 14639788;
const RELATED_TEST_FIELD = 127191267;
const TEST_ITEM_ID = 3326365902; // "CCO Club Q&A #1737" [ID3034]

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

const r = await fetch(`${PODIO_API}/item/app/${CEU_ITEMS_APP}/filter/`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ filters: { [RELATED_TEST_FIELD]: [TEST_ITEM_ID] }, limit: 100 }),
});
if (!r.ok) throw new Error(`filter ${r.status}: ${await r.text()}`);
const { items } = await r.json();
console.log(`Reverse-link filter for test item_id ${TEST_ITEM_ID}: ${items.length} CEU item(s) found`);
for (const it of items) {
  console.log(`  CEU item app_item_id ${it.app_item_id} (item_id ${it.item_id}), files: ${(it.files ?? []).map(f=>f.name).join(", ")}`);
}
