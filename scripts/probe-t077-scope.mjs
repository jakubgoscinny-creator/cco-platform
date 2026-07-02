#!/usr/bin/env node
// CCO-T077 (read-only): scope check — how many QB Multi Choice questions have
// <ul>/<ol> markup in QUESTION_TEXT (list bug candidates) and how many have
// attached image files (image bug candidates)? Sample the most recent 200.
// Run: node --env-file=.env.local scripts/probe-t077-scope.mjs
const PODIO_API = "https://api.podio.com";
const QB_APP = 16263017;
const QUESTION_TEXT_FIELD = 126153571;

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

const r = await fetch(`${PODIO_API}/item/app/${QB_APP}/filter/`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ limit: 200, sort_by: "created_on", sort_desc: true }),
});
if (!r.ok) throw new Error(`filter ${r.status}: ${await r.text()}`);
const { items } = await r.json();

let withList = 0, withImgTag = 0, withFiles = 0, withFilesAndNoImgTag = 0;
for (const it of items) {
  const field = (it.fields ?? []).find((f) => f.field_id === QUESTION_TEXT_FIELD);
  const raw = field?.values?.[0]?.value ?? "";
  const hasList = /<[uo]l/i.test(raw);
  const hasImg = /<img/i.test(raw);
  const fileCount = (it.files ?? []).filter((f) => /^image\//.test(f.mimetype ?? "")).length;
  if (hasList) withList++;
  if (hasImg) withImgTag++;
  if (fileCount > 0) withFiles++;
  if (fileCount > 0 && !hasImg) withFilesAndNoImgTag++;
}
console.log(`sampled ${items.length} most-recent QB Multi Choice items`);
console.log(`  <ul>/<ol> in question text: ${withList}`);
console.log(`  <img> tag in question text: ${withImgTag}`);
console.log(`  has image files attached:   ${withFiles}`);
console.log(`  has image files but NO <img> tag in text (orphaned attachments): ${withFilesAndNoImgTag}`);
