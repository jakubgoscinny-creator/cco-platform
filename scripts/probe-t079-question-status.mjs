// CCO-T079 read-only: live Podio QB Multi Choice Question Status field
// definition (exact option labels/ids) + current Neon status distribution,
// overall and for the reported MTA problem case. Strictly read-only.
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
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j));
  return j.access_token;
}

const token = await podioToken();
const appRes = await fetch("https://api.podio.com/app/16263017", {
  headers: { Authorization: `Bearer ${token}` },
});
const app = await appRes.json();
const statusField = app.fields.find((f) => f.field_id === 126284767);
console.log("=== Live Podio Question Status field (126284767) ===");
console.log(JSON.stringify({ label: statusField.label, config: statusField.config?.settings?.options }, null, 2));

console.log("\n=== Neon `questions.status` distribution, all questions ===");
console.log(JSON.stringify(await sql`select status, count(*)::int as n from questions group by status order by n desc`, null, 2));

console.log("\n=== MTA-linked questions: status distribution ===");
console.log(JSON.stringify(await sql`
  select q.status, count(*)::int as n
  from questions q
  join tests t on t.podio_item_id = any(q.test_podio_ids)
  where t.student_tracker_type = 'MTA'
  group by q.status order by n desc`, null, 2));
