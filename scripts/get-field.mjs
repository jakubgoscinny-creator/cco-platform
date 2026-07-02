#!/usr/bin/env node
// CCO-T034 (read-only): dump an app field's config (to plan a precise calc edit).
//   Run: node --env-file=.env --env-file=.env.local scripts/get-field.mjs 125937527 150750509
const PODIO_API = "https://api.podio.com";
const APP = 16234798;

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
for (const fid of process.argv.slice(2)) {
  const res = await fetch(`${PODIO_API}/app/${APP}/field/${fid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`field ${fid}: ${res.status} ${await res.text()}`);
    continue;
  }
  const f = await res.json();
  console.log(`\n===== field ${fid} | ${f.label} | type=${f.type} =====`);
  console.log("--- settings.script ---");
  console.log(f.config?.settings?.script);
  console.log("--- return_type:", f.config?.settings?.return_type);
}
