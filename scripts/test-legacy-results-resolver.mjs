#!/usr/bin/env node
/**
 * End-to-end test: Profile email -> Profile item -> Contact item_id ->
 * legacy test results. Validates the resolver chain matches what we expect
 * against a known student (Renee Busacca, contact app_item_id=96011).
 */
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;

const TEST_EMAIL = process.argv[2] || "reneebusacca@gmail.com";
const PLATFORM_PROFILES = 30640719;
const CONTACTS_APP = 14660191;
const TEST_RESULTS = 16234798;
const PROFILE_PERSON_FIELD = 275832534;
const PROFILE_EMAIL_EXTERNAL_ID = "email-2";
const TR_CONTACT_FIELD = 125914549;
const TR_DATE_TAKEN = 125935780;
const TR_RESULT_PERCENTAGE = 125911831;
const TR_TEST_NAME = 125911836;
const TR_TEST_SOURCE = 146183536;
const TR_PROGRESS_TYPE = 128205567;
const TR_EXAM_LOOKUP = 142217973;

async function getToken() {
  const r = await fetch(`${PODIO}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: PODIO_REFRESH_TOKEN,
      client_id: PODIO_CLIENT_ID,
      client_secret: PODIO_CLIENT_SECRET,
    }),
  });
  return (await r.json()).access_token;
}

const token = await getToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Step 1: find Profile by email
console.log(`\n[1] Looking up Profile by email: ${TEST_EMAIL}`);
const profRes = await fetch(`${PODIO}/item/app/${PLATFORM_PROFILES}/filter/`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ filters: { [PROFILE_EMAIL_EXTERNAL_ID]: TEST_EMAIL.toLowerCase() }, limit: 1 }),
});
const profJson = await profRes.json();
if (!profJson.items?.length) {
  console.log("  ! No profile found for that email. Trying name fallback ...");
  process.exit(0);
}
const profile = profJson.items[0];
console.log(`  profile.item_id=${profile.item_id} title="${profile.title}"`);

// Step 2: Profile.person -> Contact item_id
const personField = profile.fields.find((f) => f.field_id === PROFILE_PERSON_FIELD);
const contactItemId = personField?.values?.[0]?.value?.item_id;
const contactTitle = personField?.values?.[0]?.value?.title;
console.log(`\n[2] Profile.person resolves to contact: item_id=${contactItemId} ("${contactTitle}")`);
if (!contactItemId) {
  console.error("  ! Profile has no person ref — can't resolve to a Contact");
  process.exit(1);
}

// Step 3: legacy test results by Contact
console.log(`\n[3] Filtering Test Results app for contact ${contactItemId} ...`);
const trRes = await fetch(`${PODIO}/item/app/${TEST_RESULTS}/filter/`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    filters: { [TR_CONTACT_FIELD]: [contactItemId] },
    sort_by: String(TR_DATE_TAKEN),
    sort_desc: true,
    limit: 100,
  }),
});
const trJson = await trRes.json();
console.log(`  total: ${trJson.total} | filtered: ${trJson.filtered} | returned: ${trJson.items?.length}`);

// Step 4: shape results into the form the portal will render
const shaped = (trJson.items || []).slice(0, 25).map((it) => {
  const f = (id) => it.fields.find((x) => x.field_id === id)?.values || [];
  const date = f(TR_DATE_TAKEN)[0]?.start || "?";
  const score = f(TR_RESULT_PERCENTAGE)[0]?.value || null;
  const examLookup = f(TR_EXAM_LOOKUP)[0]?.value;
  const testName = examLookup?.title || (f(TR_TEST_NAME)[0]?.value ?? "");
  const source = f(TR_TEST_SOURCE)[0]?.value?.text || "";
  const type = f(TR_PROGRESS_TYPE)[0]?.value?.text || "";
  return {
    appItemId: it.app_item_id,
    date,
    score: score == null ? null : Number(score).toFixed(0) + "%",
    test: testName,
    source,
    type,
  };
});
console.log("\n[4] First 25 results (date desc):");
console.table(shaped);
