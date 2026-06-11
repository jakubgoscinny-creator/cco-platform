#!/usr/bin/env node
// CCO-T048 (read-only): do the recent forgot-password requesters have Neon
// contacts rows at all? forgotPasswordAction stores the single-use jti via
// db.update(contacts) — which silently affects 0 rows when the contact has
// never signed in (no mirror row). Submit then fails the jti cross-check.
//   Run: node --env-file=.env.local scripts/probe-reset-neon.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// sub -> emails + attempt count, from probe-password-resets.mjs output (last 7 days)
const REQUESTERS = [
  [453970999, "mary@cco.us", 3],
  [3311210875, "tracey.boyle@anthem.com", 5],
  [529124353, "happyourwe4@yahoo.com", 3],
  [3316715738, "chauraj69@gmail.com", 2],
  [468308660, "srhett@yahoo.com", 2],
  [483405991, "flatcreekchic + carrie.johnson", 2],
  [3318126143, "saheramoin@gmail.com", 1],
  [579215448, "emily.uy@atlantichealth.org", 1],
  [3311813207, "aryzvictorinojavar@gmail.com", 1],
  [3255087571, "jessdavis07@yahoo.com", 1],
  [3284556412, "jjdobeck@yahoo.com", 1],
  [3315986993, "shanhos@gmail.com", 1],
  [3315570131, "teri.shannon@outlook.com", 1],
  [847199695, "thuythanhho@yahoo.com", 1],
];

const ids = REQUESTERS.map(([id]) => id);
const rows = await sql`
  SELECT podio_item_id,
         password_reset_jti IS NOT NULL AS has_pending_jti,
         length(password_hash) > 0      AS has_hash,
         left(password_hash, 4)         AS hash_prefix
  FROM contacts
  WHERE podio_item_id = ANY(${ids})
`;
const byId = new Map(rows.map((r) => [Number(r.podio_item_id), r]));

console.log("attempts | neon row | pending jti | hash | requester");
console.log("---------+----------+-------------+------+----------");
for (const [id, email, attempts] of REQUESTERS) {
  const r = byId.get(id);
  const row = r ? "YES" : "NO ";
  const jti = r ? (r.has_pending_jti ? "stale/pending" : "consumed/none") : "-";
  const hash = r ? r.hash_prefix : "-";
  console.log(
    `   ${String(attempts).padEnd(5)} | ${row}      | ${jti.padEnd(11)} | ${String(hash).padEnd(4)} | ${id} ${email}`
  );
}

const total = await sql`SELECT count(*) AS n FROM contacts`;
console.log(`\ntotal contacts rows in Neon: ${total[0].n}`);
