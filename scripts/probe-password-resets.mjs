#!/usr/bin/env node
// CCO-T048 (read-only): diagnose "reset link invalid" reports from Mary/Laureen.
// Dumps recent Password Resets items (app 30739071): status, timing, and
// whether the stored Reset URL token is structurally intact. Never prints
// full tokens (a fresh one could reset a real account).
//   Run: node --env-file=.env.local scripts/probe-password-resets.mjs
const PODIO_API = "https://api.podio.com";
const APP = 30739071;
const F = {
  RECIPIENT_EMAIL: 277002644,
  RECIPIENT_CONTACT: 277002645,
  RESET_URL: 277002646,
  EXPIRES_AT: 277002647,
  STATUS: 277002648,
  USED_AT: 277002649,
};

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

function fieldByid(item, fid) {
  return (item.fields ?? []).find((f) => f.field_id === fid);
}

function b64urlJson(seg) {
  try {
    return JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const token = await getToken();
const res = await fetch(`${PODIO_API}/item/app/${APP}/filter/`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sort_by: "created_on", sort_desc: true, limit: 25 }),
});
if (!res.ok) throw new Error(`filter ${res.status}: ${await res.text()}`);
const data = await res.json();
console.log(`total items in app: ${data.total}\n`);

for (const item of data.items ?? []) {
  const created = new Date(item.created_on + "Z"); // Podio returns UTC
  const lastEvent = new Date(item.last_event_on + "Z");
  const flowLagMin = ((lastEvent - created) / 60000).toFixed(1);

  const email = fieldByid(item, F.RECIPIENT_EMAIL)?.values?.[0]?.value ?? "(none)";
  const hasContact = !!fieldByid(item, F.RECIPIENT_CONTACT);
  const status = fieldByid(item, F.STATUS)?.values?.[0]?.value?.text ?? "(none)";
  const expiresAt = fieldByid(item, F.EXPIRES_AT)?.values?.[0]?.start_utc ?? "(none)";
  const urlField = fieldByid(item, F.RESET_URL)?.values?.[0];
  const rawUrl =
    typeof urlField?.value === "string"
      ? urlField.value
      : urlField?.embed?.original_url ?? urlField?.embed?.url ?? "";

  let tokenInfo = "(no url)";
  if (rawUrl) {
    let host = "?";
    let tok = "";
    try {
      const u = new URL(rawUrl);
      host = u.host;
      tok = u.searchParams.get("token") ?? "";
    } catch {
      host = "UNPARSEABLE";
      const m = rawUrl.match(/token=([^&\s]*)/);
      tok = m ? m[1] : "";
    }
    const segs = tok.split(".");
    const payload = segs.length === 3 ? b64urlJson(segs[1]) : null;
    const sigLen = segs.length === 3 ? segs[2].length : -1;
    const ttlMin = payload ? ((payload.exp - payload.iat) / 60).toFixed(0) : "?";
    const expDate = payload ? new Date(payload.exp * 1000).toISOString() : "?";
    tokenInfo =
      `host=${host} urlLen=${rawUrl.length} tokLen=${tok.length} segs=${segs.length} ` +
      `sigLen=${sigLen} ttlMin=${ttlMin} jwtExp=${expDate} sub=${payload?.sub ?? "?"}`;
  }

  console.log(
    `#${item.item_id}  created=${item.created_on}Z  status=${status}  ` +
      `contact=${hasContact ? "Y" : "N"}  email=${email}\n` +
      `   lastEvent=${item.last_event_on}Z (lag ${flowLagMin}m)  fieldExpires=${expiresAt}\n` +
      `   ${tokenInfo}\n`
  );
}
