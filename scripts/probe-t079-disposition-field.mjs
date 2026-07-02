import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);
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
const dispositionField = app.fields.find((f) => f.field_id === 273026086);
console.log("=== Live Podio Disposition field (273026086) ===");
console.log(JSON.stringify({ label: dispositionField.label, type: dispositionField.type, config: dispositionField.config?.settings?.options }, null, 2));
console.log("\n=== ALL category/status-shaped fields on QB Multi Choice (candidates for the 'Question Status' the call discussed) ===");
for (const f of app.fields) {
  if (f.type === "category" || /status|state|review|draft|live|publish/i.test(f.label)) {
    console.log(`  ${f.field_id}  "${f.label}"  (${f.type})`);
  }
}
console.log("\n=== Neon `questions.disposition` distribution ===");
console.log(JSON.stringify(await sql`select disposition, count(*)::int as n from questions group by disposition order by n desc`, null, 2));
