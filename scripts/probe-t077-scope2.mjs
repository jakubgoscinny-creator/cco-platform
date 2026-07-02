#!/usr/bin/env node
// CCO-T077 (read-only): the "most recent 200" sample from probe-t077-scope.mjs
// found zero list/image cases — content this old probably isn't in the most
// recently touched items. Sample app_item_id 19180-19230 directly (the known
// repro range) instead.
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

let withList = 0, withImgTag = 0, withFiles = 0, withFilesAndNoImgTag = 0, checked = 0, missing = 0;
for (let id = 19180; id <= 19230; id++) {
  const r = await fetch(`${PODIO_API}/app/${QB_APP}/item/${id}`, { headers: auth });
  if (!r.ok) { missing++; continue; }
  const it = await r.json();
  checked++;
  const field = (it.fields ?? []).find((f) => f.field_id === QUESTION_TEXT_FIELD);
  const raw = field?.values?.[0]?.value ?? "";
  const hasList = /<[uo]l/i.test(raw);
  const hasImg = /<img/i.test(raw);
  const fileCount = (it.files ?? []).filter((f) => /^image\//.test(f.mimetype ?? "")).length;
  if (hasList) { withList++; console.log(`  list: app_item_id ${id}`); }
  if (hasImg) { withImgTag++; console.log(`  <img>: app_item_id ${id}`); }
  if (fileCount > 0) withFiles++;
  if (fileCount > 0 && !hasImg) withFilesAndNoImgTag++;
}
console.log(`\nchecked ${checked} items (app_item_id 19180-19230), ${missing} missing/404`);
console.log(`  <ul>/<ol> in question text: ${withList}`);
console.log(`  <img> tag in question text: ${withImgTag}`);
console.log(`  has image files attached:   ${withFiles}`);
console.log(`  has image files but NO <img> tag in text (orphaned attachments): ${withFilesAndNoImgTag}`);
