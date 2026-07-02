#!/usr/bin/env node
// CCO-T077 (read-only): pull the raw QUESTION_TEXT field for the two repro
// items and inspect what Podio's API actually returns — is it real HTML
// (<img>, <ul><li>) or plain-text-with-no-markup?
// Run from cco-platform/:  node --env-file=.env.local scripts/probe-t077-question-html.mjs
const PODIO_API = "https://api.podio.com";
const QB_APP = 16263017; // PODIO_APPS.QB_MULTI_CHOICE
const QUESTION_TEXT_FIELD = 126153571;
const ITEMS = [19220, 19202];

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

for (const itemId of ITEMS) {
  // 19220/19202 are Podio's short "app_item_id" (the [ID####] shown in the
  // UI), resolved via GET /app/{app_id}/item/{app_item_id}.
  const r = await fetch(`${PODIO_API}/app/${QB_APP}/item/${itemId}`, { headers: auth });
  if (!r.ok) {
    console.log(`\n=== item ${itemId}: FETCH FAILED ${r.status} ===`);
    console.log(await r.text());
    continue;
  }
  const item = await r.json();
  console.log(`\n=== item ${itemId} (app_item_id ${item.app_item_id}) ===`);
  const field = (item.fields ?? []).find((f) => f.field_id === QUESTION_TEXT_FIELD);
  if (!field) {
    console.log("QUESTION_TEXT field not found on item");
    continue;
  }
  console.log("field type:", field.type);
  console.log("field config.settings:", JSON.stringify(field.config?.settings ?? {}, null, 2));
  const raw = field.values?.[0]?.value ?? "";
  console.log("--- raw value (first 2000 chars) ---");
  console.log(raw.slice(0, 2000));
  console.log("--- contains <img>?", /<img/i.test(raw), " contains <ul>/<ol>?", /<[uo]l/i.test(raw), " contains <li>?", /<li/i.test(raw));
  console.log("--- item.files count:", (item.files ?? []).length);
  for (const f of item.files ?? []) {
    console.log("  file:", f.file_id, f.name, f.mimetype, f.link ? "(has link)" : "(no link)");
  }
}
