#!/usr/bin/env node
// CCO-T078 (read-only): how common is the "CEU item links to Test, but Test
// doesn't link back" pattern? Sample the most recent 50 CEU items and check
// both directions.
const PODIO_API = "https://api.podio.com";
const CEU_ITEMS_APP = 14639788;
const TESTS_APP = 16243239;
const RELATED_TEST_FIELD = 127191267; // CEU item -> Test
const CEU_ITEMS_FIELD = 137578199; // Test -> CEU items

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
  body: JSON.stringify({ limit: 50, sort_by: "created_on", sort_desc: true }),
});
const { items } = await r.json();

let hasRelatedTest = 0, forwardLinkPresent = 0, forwardLinkMissing = 0;
const missingList = [];
for (const ceu of items) {
  const relField = (ceu.fields ?? []).find((f) => f.field_id === RELATED_TEST_FIELD);
  const testRef = relField?.values?.[0]?.value;
  if (!testRef) continue;
  hasRelatedTest++;
  const testR = await fetch(`${PODIO_API}/item/${testRef.item_id}`, { headers: auth });
  if (!testR.ok) continue;
  const test = await testR.json();
  const ceuField = (test.fields ?? []).find((f) => f.field_id === CEU_ITEMS_FIELD);
  const backRefs = (ceuField?.values ?? []).map((v) => v.value?.item_id);
  if (backRefs.includes(ceu.item_id)) {
    forwardLinkPresent++;
  } else {
    forwardLinkMissing++;
    missingList.push({ ceuAppItemId: ceu.app_item_id, testAppItemId: test.app_item_id, testName: test.fields?.find(f=>f.field_id===125981694)?.values?.[0]?.value });
  }
}
console.log(`sampled ${items.length} recent CEU items, ${hasRelatedTest} have a related-test link`);
console.log(`  forward Test->CEU link present: ${forwardLinkPresent}`);
console.log(`  forward Test->CEU link MISSING (reverse-only): ${forwardLinkMissing}`);
console.log("missing examples:", JSON.stringify(missingList, null, 2));
