#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE legacy_test_results ADD COLUMN IF NOT EXISTS aapc_template_file_id bigint`;
await sql`ALTER TABLE legacy_test_results ADD COLUMN IF NOT EXISTS ceu_index_number text`;

const cols = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'legacy_test_results' ORDER BY ordinal_position
`;
console.table(cols);
