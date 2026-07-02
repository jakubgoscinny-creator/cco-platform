#!/usr/bin/env node
/**
 * Quick check: confirm Mary added "CCO Portal" to the test-source category
 * field on Test Results (16234798), capture the new option_id.
 */
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;

const tokRes = await fetch(`${PODIO}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: PODIO_REFRESH_TOKEN,
    client_id: PODIO_CLIENT_ID,
    client_secret: PODIO_CLIENT_SECRET,
  }),
});
const tok = (await tokRes.json()).access_token;

const r = await fetch(`${PODIO}/app/16234798`, { headers: { Authorization: `Bearer ${tok}` } });
const app = await r.json();
const tsField = app.fields.find((f) => f.field_id === 146183536);
console.log("test-source field:", tsField.label);
console.log("Options:");
for (const o of tsField.config?.settings?.options || []) {
  console.log(`  ${o.id}: ${o.text}${o.status ? ` (${o.status})` : ""}`);
}
