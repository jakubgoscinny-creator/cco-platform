#!/usr/bin/env node
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };

const email = process.argv[2] || "jakub.goscinny@futuresolutionsonline.co.uk";

// Try multiple filter shapes — Podio email-type fields are picky
for (const filter of [
  { "email-address": [email] },
  { "112436968": [email] },
  { "112436968": [{ value: email }] },
]) {
  console.log("\nfilter:", JSON.stringify(filter));
  const r = await fetch(`${PODIO}/item/app/14660191/filter/`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ filters: filter, limit: 5 }),
  });
  const j = await r.json();
  if (j.error) {
    console.log("  ERROR:", j.error_description);
  } else {
    console.log(`  total=${j.total} filtered=${j.filtered}`);
    for (const it of j.items || []) {
      const em = it.fields.find((f) => f.field_id === 112436968)?.values?.[0]?.value;
      console.log(`  - ${it.item_id} (app_item_id=${it.app_item_id}) "${it.title}" email=${em}`);
    }
  }
}
