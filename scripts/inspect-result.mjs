#!/usr/bin/env node
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}` };
const aid = process.argv[2] || "126955";
const r = await fetch(`${PODIO}/app/16234798/item/${aid}`, { headers: auth });
const it = await r.json();
console.log(`item_id=${it.item_id} app_item_id=${it.app_item_id}`);
console.log(`title: ${it.title}`);
const get = (id) => it.fields?.find((f) => f.field_id === id)?.values || [];
console.log({
  date: get(125935780)[0]?.start,
  score: get(125911831)[0]?.value,
  passed: get(125911820)[0]?.value,
  testName: get(125911836)[0]?.value,
  source: get(146183536)[0]?.value?.text,
  type: get(128205567)[0]?.value?.text,
  certUrl: get(125913685)[0]?.value,
  duration: get(125911832)[0]?.value,
  examLookup: get(142217973)[0]?.value && {
    item_id: get(142217973)[0].value.item_id,
    title: get(142217973)[0].value.title,
  },
  contact: get(125914549)[0]?.value && {
    item_id: get(125914549)[0].value.item_id,
    title: get(125914549)[0].value.title,
  },
});
