#!/usr/bin/env node
// CCO-T048 (read-only vs prod): does the LIVE deployment accept a fresh,
// well-formed reset token signed with the project-env secret?
//   - sub=999 is a nonexistent contact: even if someone replayed this token,
//     the submit-time jti cross-check fails, so it can never reset anything.
//   - GET /reset-password only pre-flight-verifies; it consumes nothing.
//   Run from cco-platform/: node --env-file=.env.local scripts/probe-reset-verify.mjs
import { SignJWT } from "jose";
import { randomUUID } from "crypto";

const secret = process.env.RESET_PASSWORD_JWT_SECRET;
if (!secret) throw new Error("RESET_PASSWORD_JWT_SECRET not in env");

const token = await new SignJWT({ purpose: "reset_password" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("cco-portal")
  .setSubject("999")
  .setJti(randomUUID())
  .setIssuedAt()
  .setExpirationTime(new Date(Date.now() + 30 * 60 * 1000))
  .sign(new TextEncoder().encode(secret));

async function probe(label, tok) {
  const url = `https://cco-platform.vercel.app/reset-password?token=${encodeURIComponent(tok)}`;
  const res = await fetch(url, { redirect: "manual" });
  const body = await res.text();
  const verdict = body.includes("Set a new password")
    ? "FORM RENDERED (token accepted)"
    : body.includes("This link is no longer valid")
      ? "INVALID PAGE"
      : `NEITHER MARKER (status ${res.status})`;
  console.log(`${label}: HTTP ${res.status} | cache=${res.headers.get("x-vercel-cache")} | ${verdict}`);
}

await probe("signed fresh token", token);
await probe("garbage token     ", "not-a-jwt");
