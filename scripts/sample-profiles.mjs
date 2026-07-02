#!/usr/bin/env node
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };

const r = await fetch(`${PODIO}/item/app/30640719/filter/`, {
  method: "POST", headers: auth,
  body: JSON.stringify({ limit: 5, sort_by: "created_on", sort_desc: true }),
});
const j = await r.json();
console.log(`total profiles: ${j.total}`);
for (const it of j.items || []) {
  const personField = it.fields.find((f) => f.field_id === 275832534);
  const emailField = it.fields.find((f) => f.external_id === "email-2");
  const personRef = personField?.values?.[0]?.value;
  console.log(`  - profile ${it.item_id} (app_item_id=${it.app_item_id}) "${it.title}"`);
  console.log(`      email: ${emailField?.values?.[0]?.value || ""}`);
  console.log(`      person ref: ${personRef ? `Contact item_id=${personRef.item_id} ("${personRef.title}")` : "NONE"}`);
}
