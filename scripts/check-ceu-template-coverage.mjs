#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const ts = await sql`SELECT count(*)::int AS n FROM tests`;
const ci = await sql`SELECT count(*)::int AS n FROM ceu_items`;
const ciWith = await sql`SELECT count(*)::int AS n FROM ceu_items WHERE certificate_template_file_id IS NOT NULL`;
console.log("tests rows:", ts[0].n);
console.log("ceu_items rows:", ci[0].n);
console.log("ceu_items with template:", ciWith[0].n);

if (ciWith[0].n > 0) {
  const sample = await sql`
    SELECT podio_item_id, title, ceu_index_number, certificate_template_file_id, related_test_podio_id
    FROM ceu_items
    WHERE certificate_template_file_id IS NOT NULL
    LIMIT 5
  `;
  console.table(sample);
}
