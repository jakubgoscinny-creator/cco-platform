#!/usr/bin/env node
// CCO-T048 e2e: create a throwaway Contact with NO password master and no
// prior portal sign-in — the exact population the fix targets. Email is a
// plus-alias of Jakub's Gmail so the reset email is readable in-session.
//   Run: node --env-file=.env.local scripts/create-t048-test-contact.mjs
const PODIO_API = "https://api.podio.com";
const CONTACTS_APP = 14660191;
const F = { NAME: 112436965, EMAIL: 112436968 };
const EMAIL = "jakub.goscinny+cco-t048@gmail.com";

async function getToken() {
  const res = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const token = await getToken();

// Refuse to create twice
const dup = await fetch(`${PODIO_API}/item/app/${CONTACTS_APP}/filter/`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ filters: { [F.EMAIL]: [EMAIL] }, limit: 1 }),
});
const dupData = await dup.json();
if ((dupData.items ?? []).length > 0) {
  console.log(`already exists: item ${dupData.items[0].item_id}`);
  process.exit(0);
}

const res = await fetch(`${PODIO_API}/item/app/${CONTACTS_APP}/`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: {
      [F.NAME]: "ZZ Reset Flow Test (CCO-T048 - safe to delete after 2026-06)",
      [F.EMAIL]: [{ type: "other", value: EMAIL }],
    },
  }),
});
if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
const item = await res.json();
console.log(`created test contact: item ${item.item_id} (${EMAIL})`);
