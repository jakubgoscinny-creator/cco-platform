#!/usr/bin/env node
// CCO-T031: probe the password-policy validator.
//
// Runs each branch of validatePassword against representative inputs
// and asserts the expected verdict. Mirrors src/lib/password-policy.ts
// (the mjs probe doesn't import TS).
//
// Run: node scripts/probe-t031-policy.mjs

import { createHash } from "crypto";

const MIN_LENGTH = 8;
const STATIC_BLOCKLIST = ["cco", "academy", "password", "qwerty"];

async function validatePassword(candidate, ctx = {}) {
  if (candidate.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  const lower = candidate.toLowerCase();
  const blocklist = [...STATIC_BLOCKLIST];
  if (ctx.email) {
    const local = ctx.email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 3) blocklist.push(local);
  }
  for (const term of blocklist) {
    if (term && lower.includes(term)) {
      return "Please choose a password that doesn't include your email, our brand name, or other obvious words.";
    }
  }
  if (ctx.oldPassword) {
    if (candidate === ctx.oldPassword) return "New password must differ from your current password.";
    if (
      ctx.oldPassword.length >= MIN_LENGTH &&
      (lower.includes(ctx.oldPassword.toLowerCase()) ||
        ctx.oldPassword.toLowerCase().includes(lower))
    ) {
      return "New password is too similar to your current password.";
    }
  }
  const inBreach = await isPasswordInBreachCorpus(candidate);
  if (inBreach) {
    return "This password has appeared in a known data breach and cannot be used. Please choose a different one.";
  }
  return null;
}

async function isPasswordInBreachCorpus(plaintext) {
  try {
    const digest = createHash("sha1").update(plaintext).digest("hex").toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "User-Agent": "cco-platform-probe/1.0", "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      if (line.slice(0, idx) === suffix && Number(line.slice(idx + 1)) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

let failed = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failed += 1; }
}
async function expect(name, candidate, ctx, expectedSubstring) {
  const r = await validatePassword(candidate, ctx);
  if (expectedSubstring === null) {
    check(name, r === null, `(got: ${JSON.stringify(r)})`);
  } else {
    check(name, r !== null && r.includes(expectedSubstring), `(got: ${JSON.stringify(r)})`);
  }
}

console.log("=== length ===");
await expect("rejects 7-char password", "abc1234", {}, "at least 8");
await expect("accepts 8-char unique password", `Qx7${Date.now() % 100000}`, {}, null);

console.log("=== breach corpus (HIBP) ===");
await expect("rejects 12345678 (in HIBP)", "12345678", {}, "data breach");
await expect("rejects 'password'", "password", {}, "obvious words"); // blocklist hits first
await expect("rejects 'qwertyuiop'", "qwertyuiop", {}, "obvious words"); // blocklist
await expect("rejects 'letmein123'", "letmein123", {}, "data breach");
await expect("accepts a truly random string", `cw7-aurora-thicket-${Date.now()}`, {}, null);

console.log("=== context blocklist ===");
await expect("rejects email local in password", "jakubgoscinny!", { email: "jakubgoscinny@example.com" }, "obvious words");
await expect("rejects 'cco' substring", "iLoveCCOAcademy123", {}, "obvious words");
await expect("rejects 'academy' substring", "AcademyRules!Forever", {}, "obvious words");

console.log("=== old password protection ===");
await expect("rejects identical old", "OldPass99!", { oldPassword: "OldPass99!" }, "differ");
await expect("rejects new contains old", "OldPass99!Plus", { oldPassword: "OldPass99!" }, "too similar");
await expect("accepts unrelated new", "MorningGlory-7", { oldPassword: "OldPass99!" }, null);

if (failed > 0) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll policy probe checks passed.");
