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

// Get real MTA question item_ids from the Neon mirror (already linked via test_podio_ids).
const mtaQuestions = await sql`
  select q.podio_item_id
  from questions q
  join tests t on t.podio_item_id = any(q.test_podio_ids)
  where t.student_tracker_type = 'MTA'`;
console.log(`MTA-linked question count (from Neon mirror): ${mtaQuestions.length}`);

// Check the real gate field (276090193) for a sample via Podio filter, scoped
// by item_id isn't directly filterable in bulk cheaply -- instead check the
// gate-field count intersected with the Tests app-ref for MTA tests.
const mtaTestIds = await sql`select podio_item_id from tests where student_tracker_type = 'MTA'`;
const testIds = mtaTestIds.map(r => Number(r.podio_item_id));
console.log(`MTA test ids: ${testIds.length}`);

async function filterCount(filters) {
  const res = await fetch("https://api.podio.com/item/app/16263017/filter/", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filters, limit: 1 }),
  });
  return (await res.json()).filtered;
}
const gateOptions = [{id:3,text:"Draft"},{id:4,text:"Under Review"},{id:1,text:"Current"},{id:2,text:"Updated"},{id:5,text:"Archived"}];
console.log("\nMTA-linked questions by gate status (276090193), via Tests app-ref filter:");
for (const opt of gateOptions) {
  const n = await filterCount({ 137526907: testIds, 276090193: [opt.id] });
  console.log(`  ${opt.text.padEnd(20)} n=${n}`);
}
const totalMta = await filterCount({ 137526907: testIds });
console.log(`  TOTAL MTA-linked (any/no gate status): ${totalMta}`);
