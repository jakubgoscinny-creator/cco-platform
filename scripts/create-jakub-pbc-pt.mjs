#!/usr/bin/env node
// One-off (Jakub's request): create a Progress Tracker for Jakub's Contact so
// the PBC chapter exams (Student tier) display for him, then resolve+mirror his
// enrolled tracker types into Neon so they show immediately. Minimal fields
// (student + type) to avoid tripping the PT app's onboarding automations.
//   Run: node --env-file=.env.local scripts/create-jakub-pbc-pt.mjs
import { neon } from "@neondatabase/serverless";

const P = "https://api.podio.com";
const PT_APP = 16163523;
const F_STUDENT = 125306242; // app ref → Contacts
const F_TYPE = 128205285;    // category — PBC = option id 3
const CONTACT = 2911468032;  // jakub.goscinny@futuresolutionsonline.co.uk
const PBC = 3;

async function getToken() {
  const r = await fetch(`${P}/oauth/token`, {
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

const token = await getToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// 1) Create the Progress Tracker (student + PBC type only).
const cr = await fetch(`${P}/item/app/${PT_APP}/`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ fields: { [F_STUDENT]: [CONTACT], [F_TYPE]: PBC } }),
});
if (!cr.ok) throw new Error(`createItem ${cr.status}: ${await cr.text()}`);
const created = await cr.json();
console.log(`Created Progress Tracker item ${created.item_id} (student ${CONTACT}, type PBC)`);

// 2) Resolve enrolled tracker types the SAME way the portal does (filter PT app
//    by student), to validate the resolver + capture the set.
const fr = await fetch(`${P}/item/app/${PT_APP}/filter`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ filters: { [F_STUDENT]: [CONTACT] }, limit: 50 }),
});
if (!fr.ok) throw new Error(`filter ${fr.status}: ${await fr.text()}`);
const items = (await fr.json()).items ?? [];
const types = [
  ...new Set(
    items
      .map((it) => (it.fields ?? []).find((f) => f.field_id === F_TYPE)?.values?.[0]?.value?.text)
      .filter(Boolean)
  ),
];
console.log(`Resolver sees ${items.length} PT(s) for the contact → tracker types: ${JSON.stringify(types)}`);

// 3) Mirror into Neon so it shows on next catalog load (no re-sign-in needed).
const sql = neon(process.env.DATABASE_URL);
await sql`UPDATE contacts SET enrolled_tracker_types = ${types}::text[] WHERE podio_item_id = ${CONTACT}`;

// 4) How many tests will he now see?
const vis = await sql`
  SELECT count(*)::int AS n FROM tests
  WHERE ready_for_portal AND (
    access_tier = ${"Free"} OR
    (access_tier = ${"Student"} AND student_tracker_type = ANY(${types}::text[]))
  )`;
const pbc = await sql`SELECT count(*)::int AS n FROM tests WHERE ready_for_portal AND access_tier=${"Student"} AND student_tracker_type=${"PBC"}`;
console.log(`Neon updated. Jakub now sees ~${vis[0].n} unlocked (Free + his PBC), incl. ${pbc[0].n} PBC chapter tests (+ Club tests shown locked).`);
