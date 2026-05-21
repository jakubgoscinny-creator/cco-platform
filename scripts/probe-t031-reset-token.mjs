#!/usr/bin/env node
// CCO-T031: probe the reset-token JWT helpers.
//
// Exercises:
//   1. sign → verify roundtrip yields the same contactId + jti.
//   2. Wrong-secret JWT rejected.
//   3. Wrong-issuer JWT rejected.
//   4. Wrong-purpose JWT rejected.
//   5. Expired JWT rejected.
//   6. Tampered JWT rejected.
//
// Run: node --env-file=.env scripts/probe-t031-reset-token.mjs

import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";

const SECRET = process.env.RESET_PASSWORD_JWT_SECRET;
if (!SECRET) {
  console.error("Missing RESET_PASSWORD_JWT_SECRET (load .env first).");
  process.exit(2);
}
const secretBytes = new TextEncoder().encode(SECRET);

const ISSUER = "cco-portal";
const PURPOSE = "reset_password";

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failed += 1;
  }
}

async function sign({ contactId, jti, ttlSeconds = 30 * 60, issuer = ISSUER, purpose = PURPOSE, secret = secretBytes }) {
  return new SignJWT({ purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setSubject(String(contactId))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

async function verify(token, secret = secretBytes) {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    algorithms: ["HS256"],
  });
  if (payload.purpose !== PURPOSE) throw new Error("wrong purpose");
  if (typeof payload.sub !== "string") throw new Error("no sub");
  if (typeof payload.jti !== "string") throw new Error("no jti");
  return { contactId: Number(payload.sub), jti: payload.jti };
}

// 1. roundtrip
const jti1 = randomUUID();
const t1 = await sign({ contactId: 123456, jti: jti1 });
const v1 = await verify(t1);
check("roundtrip preserves contactId", v1.contactId === 123456);
check("roundtrip preserves jti", v1.jti === jti1);

// 2. wrong secret
const otherSecret = new TextEncoder().encode("a".repeat(64));
const t2 = await sign({ contactId: 1, jti: randomUUID(), secret: otherSecret });
let rejectedWrongSecret = false;
try { await verify(t2); } catch { rejectedWrongSecret = true; }
check("wrong-secret JWT rejected", rejectedWrongSecret);

// 3. wrong issuer
const t3 = await sign({ contactId: 1, jti: randomUUID(), issuer: "evil" });
let rejectedWrongIssuer = false;
try { await verify(t3); } catch { rejectedWrongIssuer = true; }
check("wrong-issuer JWT rejected", rejectedWrongIssuer);

// 4. wrong purpose
const t4 = await sign({ contactId: 1, jti: randomUUID(), purpose: "something_else" });
let rejectedWrongPurpose = false;
try { await verify(t4); } catch { rejectedWrongPurpose = true; }
check("wrong-purpose JWT rejected", rejectedWrongPurpose);

// 5. expired
const t5 = await sign({ contactId: 1, jti: randomUUID(), ttlSeconds: -10 });
let rejectedExpired = false;
try { await verify(t5); } catch { rejectedExpired = true; }
check("expired JWT rejected", rejectedExpired);

// 6. tampered (flip one char in the signature)
const t6 = t1.slice(0, -1) + (t1.endsWith("A") ? "B" : "A");
let rejectedTampered = false;
try { await verify(t6); } catch { rejectedTampered = true; }
check("tampered JWT rejected", rejectedTampered);

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll reset-token probe checks passed.");
