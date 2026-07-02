#!/usr/bin/env node
const PODIO = "https://api.podio.com";
const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;
const tok = await (await fetch(`${PODIO}/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: PODIO_REFRESH_TOKEN, client_id: PODIO_CLIENT_ID, client_secret: PODIO_CLIENT_SECRET }),
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}` };

// Jakub's Contact (item_id from earlier resolver test): 2911468032
const contactItemId = Number(process.argv[2] || 2911468032);
const r = await fetch(`${PODIO}/item/${contactItemId}`, { headers: auth });
const item = await r.json();
const get = (id) => item.fields?.find((f) => f.field_id === id)?.values || [];
const credentialFields = {
  "112436965 name": get(112436965)[0]?.value,
  "112436968 email-address": get(112436968)[0]?.value,
  "199426794 username MASTER [H]": get(199426794)[0]?.value,
  "199426950 username (calc)": get(199426950)[0]?.value,
  "199172888 password MASTER [H]": get(199172888)[0]?.value,
  "199172889 password (calc)": get(199172889)[0]?.value,
  "134218375 subscription-status": get(134218375)[0]?.value?.text,
  "199121592 xenforo-user-id": get(199121592)[0]?.value,
  "272609487 circle-user-id": get(272609487)[0]?.value,
};
console.log(`Contact item_id=${contactItemId} title="${item.title}"`);
console.log(JSON.stringify(credentialFields, null, 2));
