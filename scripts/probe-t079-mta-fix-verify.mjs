// CCO-T079 final verification: for the actual MTA test(s) with the reported
// 200-questions overflow, confirm getMirroredQuestionsForTest's new gate
// filter caps them to the curated Current set. Strictly read-only.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

// Find MTA test(s) whose linked-question count looks like the reported
// overflow (close to 200), to identify the specific chapter Mary described.
const mtaTests = await sql`
  select t.podio_item_id, t.test_name,
    (select count(*)::int from questions q where t.podio_item_id = any(q.test_podio_ids)) as linked
  from tests t
  where t.student_tracker_type = 'MTA' and t.ready_for_portal = true
  order by linked desc limit 5`;
console.log("Top MTA tests by linked-question count:");
console.log(JSON.stringify(mtaTests, null, 2));

for (const t of mtaTests) {
  const rows = await sql`
    select gate_status_option_id from questions
    where ${t.podio_item_id} = any(test_podio_ids)`;
  const isGated = rows.some(r => r.gate_status_option_id != null);
  const after = isGated ? rows.filter(r => r.gate_status_option_id === 1).length : rows.length;
  console.log(`\n"${t.test_name}" (${t.podio_item_id}): ${rows.length} linked -> gated=${isGated} -> ${after} would serve after CCO-T079's filter`);
}
