/**
 * Password policy (CCO-T031 hardening pass).
 *
 * Validates a candidate password against:
 *   1. Length ≥ 8 (matches the v1 floor; resist composition rules per NIST
 *      800-63B-3 §5.1.1.2 — those push users toward predictable patterns).
 *   2. Context blocklist: must not contain the user's email-localpart,
 *      the strings "cco" or "academy", or (when known) the user's old
 *      password. Catches the obviously-bad-for-this-account cases.
 *   3. Breach-corpus check via Have I Been Pwned's Pwned Passwords API
 *      using k-anonymity (we send only the first 5 chars of the SHA-1
 *      hex of the password; HIBP returns a list of suffixes + breach
 *      counts; we never transmit the password itself). Catches public
 *      breach corpus entries — `12345678`, `password`, `qwertyuiop`,
 *      etc. Fail-open on HIBP network/timeout errors (logged) so an
 *      outage at HIBP doesn't block password changes.
 *
 * Returns null on pass, an error string on fail. The error is the user-
 * facing message; callers can surface it directly.
 */

import { createHash } from "crypto";

const MIN_LENGTH = 8;
const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 4_000;

const STATIC_BLOCKLIST = ["cco", "academy", "password", "qwerty"];

export interface ValidationContext {
  /** User's email — local part is added to the blocklist. */
  email?: string;
  /** User's old password (change-password flow). Blocked verbatim and
   *  via simple "new-contains-old" / "old-contains-new" heuristics. */
  oldPassword?: string;
}

export async function validatePassword(
  candidate: string,
  ctx: ValidationContext = {}
): Promise<string | null> {
  // 1. Length.
  if (candidate.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }

  // 2. Context blocklist (case-insensitive substring match).
  const lower = candidate.toLowerCase();
  const blocklist: string[] = [...STATIC_BLOCKLIST];
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
    if (candidate === ctx.oldPassword) {
      return "New password must differ from your current password.";
    }
    // Block trivial variants — old contained in new (or vice versa) for
    // passwords long enough to be meaningful.
    if (
      ctx.oldPassword.length >= MIN_LENGTH &&
      (lower.includes(ctx.oldPassword.toLowerCase()) ||
        ctx.oldPassword.toLowerCase().includes(lower))
    ) {
      return "New password is too similar to your current password.";
    }
  }

  // 3. HIBP breach-corpus check (k-anonymity).
  const inBreach = await isPasswordInBreachCorpus(candidate);
  if (inBreach) {
    return "This password has appeared in a known data breach and cannot be used. Please choose a different one.";
  }

  return null;
}

/**
 * SHA-1 hash the password, send first 5 hex chars to HIBP's range
 * endpoint, scan the returned suffix list for our remaining 35 chars.
 * Never transmits the password itself.
 *
 * Fail-open on any error (returns false) — better to let the user
 * through than to block a password change because HIBP is down.
 */
async function isPasswordInBreachCorpus(plaintext: string): Promise<boolean> {
  let prefix: string;
  let suffix: string;
  try {
    const digest = createHash("sha1").update(plaintext).digest("hex").toUpperCase();
    prefix = digest.slice(0, 5);
    suffix = digest.slice(5);
  } catch (err) {
    console.error("password-policy: SHA-1 unavailable, skipping HIBP check:", err);
    return false;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HIBP_TIMEOUT_MS);
  try {
    const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: "GET",
      headers: {
        // HIBP recommends a descriptive User-Agent so they can debug
        // abuse signals. Doesn't need an API key for the range endpoint.
        "User-Agent": "cco-platform-password-policy/1.0",
        "Add-Padding": "true", // pads the response so attackers can't
                                // infer the prefix from response length.
      },
      signal: ac.signal,
    });
    if (!res.ok) {
      console.warn(`password-policy: HIBP returned ${res.status}, failing open`);
      return false;
    }
    const body = await res.text();
    // Each line is `SUFFIX:COUNT`. We treat any non-zero count as "in breach".
    // Padded entries have count 0, so the count check naturally excludes them.
    for (const line of body.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const lineSuffix = line.slice(0, idx);
      const count = Number(line.slice(idx + 1));
      if (lineSuffix === suffix && count > 0) return true;
    }
    return false;
  } catch (err) {
    console.warn("password-policy: HIBP request failed, failing open:", err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
