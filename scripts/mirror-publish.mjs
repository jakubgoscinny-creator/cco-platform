import fs from "node:fs";
for(const l of fs.readFileSync(".env.local","utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const ids = [3048659331, 3292123496];
const before = await sql`select podio_item_id, test_name, ready_for_portal from tests where podio_item_id in (3048659331,3292123496)`;
console.log("BEFORE (rows present in mirror):", before.length);
before.forEach(r=>console.log("  ", r.podio_item_id, "|", r.test_name, "| ready_for_portal=", r.ready_for_portal));
const upd = await sql`update tests set ready_for_portal = true, synced_at = now() where podio_item_id in (3048659331,3292123496) returning podio_item_id, test_name, ready_for_portal`;
console.log("\nUPDATED rows:", upd.length);
upd.forEach(r=>console.log("  ✅", r.podio_item_id, "|", r.test_name, "| ready_for_portal=", r.ready_for_portal));
const total = await sql`select count(*)::int as n from tests where ready_for_portal = true`;
console.log("\nTotal ready_for_portal tests now:", total[0].n);
