#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

console.log("describe tests table columns:");
const cols = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'tests' ORDER BY ordinal_position
`;
console.table(cols);

console.log("\ndescribe ceu_items columns:");
const ceuCols = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'ceu_items' ORDER BY ordinal_position
`;
console.table(ceuCols);

console.log("\nrun a select on tests (limit 1) to see if it errors:");
try {
  const r = await sql`SELECT * FROM tests LIMIT 1`;
  console.log("OK, columns returned:", Object.keys(r[0] || {}));
} catch (e) {
  console.error("ERROR:", e.message);
}
