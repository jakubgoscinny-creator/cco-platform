#!/usr/bin/env node
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };

const contactItemId = Number(process.argv[2] || 3275345593); // Renee
console.log(`Filter Test Results by Contact item_id=${contactItemId}`);

const r = await fetch(`${PODIO}/item/app/16234798/filter/`, {
  method: "POST", headers: auth,
  body: JSON.stringify({
    filters: { "125914549": [contactItemId] },
    sort_by: "125935780",
    sort_desc: true,
    limit: 30,
  }),
});
const j = await r.json();
console.log(`total=${j.total} filtered=${j.filtered} returned=${j.items?.length}`);

const rows = (j.items || []).map((it) => {
  const f = (id) => it.fields.find((x) => x.field_id === id)?.values || [];
  const examLookup = f(142217973)[0]?.value;
  return {
    aid: it.app_item_id,
    date: f(125935780)[0]?.start || "",
    score: f(125911831)[0]?.value ? `${Number(f(125911831)[0].value).toFixed(0)}%` : "",
    test: examLookup?.title?.slice(0, 50) || f(125911836)[0]?.value?.slice(0, 50) || "",
    src: f(146183536)[0]?.value?.text || "",
    type: f(128205567)[0]?.value?.text || "",
  };
});
console.table(rows);
