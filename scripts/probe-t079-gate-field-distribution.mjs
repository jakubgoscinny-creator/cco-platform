import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function podioToken() {
  const res = await fetch("https://podio.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID, client_secret: process.env.PODIO_CLIENT_SECRET }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j));
  return j.access_token;
}
const token = await podioToken();
const app = await (await fetch("https://api.podio.com/app/16263017", { headers: { Authorization: `Bearer ${token}` } })).json();
const f = app.fields.find((x) => x.field_id === 276090193);
console.log("=== Field 276090193 full option list (id + text) ===");
console.log(JSON.stringify(f.config.settings.options, null, 2));

async function filterCount(body) {
  const res = await fetch("https://api.podio.com/item/app/16263017/filter/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filters: body, limit: 1 }),
  });
  const j = await res.json();
  return j.filtered;
}

console.log("\n=== Distribution across all questions (one filtered count per option) ===");
for (const opt of f.config.settings.options) {
  const n = await filterCount({ [276090193]: [opt.id] });
  console.log(`  ${opt.text.padEnd(30)} id=${opt.id}  n=${n}`);
}
const totalUnfiltered = await filterCount({});
console.log(`  TOTAL questions in app: ${totalUnfiltered}`);

// MTA-specific: filter by both the gate field AND the Tests app-ref pointing
// at any MTA test. First find MTA test ids from Neon-adjacent Podio Tests app.
console.log("\n=== MTA-linked question count by gate status ===");
const mtaTestsRes = await fetch("https://api.podio.com/item/app/16243239/filter/", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ filters: { 137578143: ["MTA"] }, limit: 100 }),
}).catch(() => null);
