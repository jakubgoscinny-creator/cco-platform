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

const candidateIds = [276081962,276082456,276082789,276082848,276082881,276083258,276083329,276086780,276086787,276086836,276086870,276086890,276087011,276087183,276087462,276088038,276088749,276088764,276089023,276090193,274995318];

for (const id of candidateIds) {
  const f = app.fields.find((x) => x.field_id === id);
  if (!f) { console.log(`${id}: NOT FOUND`); continue; }
  const opts = (f.config?.settings?.options ?? []).map((o) => o.text);
  const status = f.status;
  console.log(`${id}  status=${status}  "${f.label}"  options=[${opts.join(" | ")}]`);
}
