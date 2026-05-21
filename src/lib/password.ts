/**
 * Password hashing + verification helper.
 *
 * Hashing: argon2id with OWASP Password Storage Cheat Sheet 2024
 * parameters (m=19 MiB, t=2, p=1). Locked for CCO-T031 — see
 * `agents-tasks-knowledge/tasks/tasks.md#cco-t031`.
 *
 * Verification: multi-algo ladder so we can transition existing accounts
 * without breaking them. Dispatch by stored-hash prefix:
 *   - "$argon2..." → argon2 verify (new writes; T031 reset path + future
 *     bcrypt-upgrade-on-login replacement)
 *   - "$2..."      → bcrypt (existing upgrade-on-login path)
 *   - 32 hex chars → MD5 (legacy Zenforo accounts)
 *   - anything else → plain-text equality (very legacy; should not exist
 *     in practice but kept so a broken row doesn't silently lock the user
 *     out)
 *
 * Why argon2id (not bcrypt) for new writes:
 *   - OWASP 2024 top recommendation; PHC 2015 winner.
 *   - Defends against GPU + side-channel attacks better than bcrypt.
 *   - `@node-rs/argon2` is a precompiled native binding — works on Vercel
 *     Node runtimes with no build-time C toolchain.
 */

import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { compare as bcryptCompare } from "bcryptjs";
import { createHash } from "crypto";

// OWASP Password Storage Cheat Sheet 2024 minimums. Tune memoryCost
// upward later if Vercel function CPU/memory headroom allows.
//
// Algorithm is omitted: @node-rs/argon2's default IS Argon2id (per its
// own type docs: "Default value, this is the default algorithm for
// normative recommendations"). Avoiding the explicit enum reference also
// sidesteps TypeScript's isolatedModules ban on ambient const enums.
//
// outputLen (NOT hashLength) is this lib's option name for the digest
// length. The salt length is fixed by the library — no salt-length knob
// is exposed.
const ARGON2ID_OPTIONS = {
  memoryCost: 19_456, // KiB (= 19 MiB)
  timeCost: 2,         // iterations
  parallelism: 1,
  outputLen: 32,
} as const;

const MD5_RE = /^[a-f0-9]{32}$/i;

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2Hash(plaintext, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string
): Promise<boolean> {
  if (!storedHash) return false;

  // argon2 — modular crypt format starts "$argon2id$", "$argon2i$", "$argon2d$"
  if (storedHash.startsWith("$argon2")) {
    try {
      return await argon2Verify(storedHash, plaintext);
    } catch {
      // Malformed argon2 record (corrupt row, partial write, etc.) — fail
      // closed rather than throwing the error out to the auth path.
      return false;
    }
  }

  // bcrypt — $2a$ / $2b$ / $2y$
  if (storedHash.startsWith("$2")) {
    return bcryptCompare(plaintext, storedHash);
  }

  // Legacy MD5 (32 hex chars — Zenforo era)
  if (MD5_RE.test(storedHash)) {
    const md5 = createHash("md5").update(plaintext).digest("hex");
    return md5.toLowerCase() === storedHash.toLowerCase();
  }

  // Plain-text equality. Very legacy. Should not exist; kept so a broken
  // row doesn't silently lock the user out.
  return plaintext === storedHash;
}
