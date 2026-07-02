#!/usr/bin/env node
/**
 * Trigger sync via the same code path the gradebook uses, then read back
 * date_taken from Neon to confirm the fix.
 */
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };

const RENEE_CONTACT_ID = 3275345593;
console.log("Filtering test results for Renee ...");
const r = await fetch(`${PODIO}/item/app/16234798/filter/`, {
  method: "POST", headers: auth,
  body: JSON.stringify({ filters: { "125914549": [RENEE_CONTACT_ID] }, sort_by: "125935780", sort_desc: true, limit: 5 }),
});
const j = await r.json();

// Replicate the FIXED getDateValue
function getDate(field) {
  const v = field?.values?.[0];
  if (!v) return null;
  const start = v.start_utc ?? v.start ?? v.start_date;
  return start ? new Date(start) : null;
}

console.log("First 5 results, parsing date the new way:");
for (const it of j.items || []) {
  const dateField = it.fields.find((f) => f.field_id === 125935780);
  const date = getDate(dateField);
  console.log(`  app_item_id=${it.app_item_id} dateTaken=${date?.toISOString() ?? "NULL"}`);
}
