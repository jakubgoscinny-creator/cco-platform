"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { fetchContactFromPodio } from "@/lib/auth";
import { hashPassword, makeResetPendingSentinel } from "@/lib/password";
import { validatePassword } from "@/lib/password-policy";
import { checkAndIncrement } from "@/lib/rate-limit";
import {
  signResetToken,
  verifyResetToken,
  RESET_TOKEN_TTL_SECONDS,
} from "@/lib/password-reset";
import { createPasswordResetItem } from "@/lib/password-reset-podio";
import {
  filterItems,
  getCategoryOptionId,
  PODIO_APPS,
  CONTACT_FIELDS,
  CONTACT_DUPLICATE_STATUS,
} from "@/lib/podio";

// /forgot-password rate limit: 5 requests per IP per hour. Enough that
// a real user retrying after a typo or "didn't get email" complaint is
// fine, low enough that a single-IP flood can't burn through Podio's
// hourly cap (which is what tripped us 2026-05-21).
const FORGOT_RATE_LIMIT_MAX = 5;
const FORGOT_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// /forgot-password
// ---------------------------------------------------------------------------

/**
 * Submit handler for the forgot-password form.
 *
 * Enumeration-safe: returns the SAME success state regardless of whether
 * the email matched a Contact. The Podio item is always created, so the
 * outside-visible response time is identical for hits and misses. The
 * Podio workflow decides whether to actually send (Recipient Contact set
 * → send, blank → Skipped).
 *
 * Errors that the user can't usefully act on (Podio down, Neon down,
 * argon2 bug, etc.) are logged server-side and surface as a soft
 * "something went wrong, try again later" — we don't leak the cause.
 */
export async function forgotPasswordAction(
  _prevState: { sent?: boolean; error?: string } | null,
  formData: FormData
): Promise<{ sent?: boolean; error?: string } | null> {
  const rawEmail = formData.get("email");
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return { error: "Please enter the email you used to sign up." };
  }
  // CCO-T028: Podio's email-field filter is case-sensitive on the stored
  // value. Keep `email` (lowercase) for the recipient-email written to
  // the Podio Password Resets item, but look up the Contact by the
  // as-typed case first (handles mixed-case Contacts like
  // "Jodi.Vongunten@gmail.com") with a lowercase fallback.
  const emailAsTyped = rawEmail.trim();
  const email = emailAsTyped.toLowerCase();

  // Per-IP rate limit. Runs BEFORE any Podio work, so a flood from one
  // address can't burn the hourly Podio cap.
  const ip = await getClientIp();
  const verdict = await checkAndIncrement(
    `forgot:ip:${ip}`,
    FORGOT_RATE_LIMIT_MAX,
    FORGOT_RATE_LIMIT_WINDOW_SECONDS
  );
  if (!verdict.allowed) {
    const minutes = Math.ceil(verdict.retryAfterSeconds / 60);
    return {
      error: `Too many reset requests from this network. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  try {
    // CCO-T028 retry: prefer as-typed case (matches mixed-case Contacts),
    // fall back to lowercase if no hit. The hit-rate cost is one extra
    // Podio call only when the input case wasn't already lowercase, and
    // forgot-password is rate-limited per IP, so the cap impact is bounded.
    let contact = await findContactByEmail(emailAsTyped);
    if (!contact && emailAsTyped !== email) {
      contact = await findContactByEmail(email);
    }
    // ALL-CAPS legacy/Thrivecart Contacts (e.g. "AMANDAS.OLSEN1@GMAIL.COM")
    // won't match a lowercase filter — Podio's email filter is case-sensitive.
    // Try uppercase last so those members can actually reset (2026-06 report).
    if (!contact) {
      const upper = emailAsTyped.toUpperCase();
      if (upper !== emailAsTyped && upper !== email) {
        contact = await findContactByEmail(upper);
      }
    }

    if (contact) {
      // CCO-T048: the single-use jti lives on the Neon mirror row — but a
      // contact who has never signed in has NO row, and the previous bare
      // UPDATE silently affected 0 rows, making every emailed link fail
      // the submit-time cross-check ("already been used or invalidated").
      // That population — never-signed-in legacy users — is exactly who
      // forgot-password exists for, so:
      //   1. If no mirror row owns this email, seed one from Podio the
      //      same way first-sign-in does (preserves "I remembered my
      //      password after all" sign-ins — authenticate() is mirror-first
      //      and must keep verifying against the real legacy hash).
      //   2. If Podio has nothing to seed from (no PASSWORD_MASTER —
      //      fetchContactFromPodio returns null), fall through to an
      //      INSERT with a reset-pending sentinel hash below. The ladder
      //      rejects the sentinel outright, and authenticate() treats a
      //      sentinel row as not-yet-seeded.
      //   3. Sign the token for the row that actually holds the jti
      //      (effectiveId), so token.sub == row key == the row sign-in
      //      resolves by email — even when Podio holds duplicate contacts
      //      and the duplicate-aware pick differs from the seeded row.
      let mirror = await db.query.contacts.findFirst({
        where: eq(contacts.email, email),
      });
      if (!mirror) {
        mirror = (await fetchContactFromPodio(emailAsTyped)) ?? undefined;
      }
      const effectiveId = mirror?.podioItemId ?? contact.podioItemId;

      const { token, jti, expiresAt } = await signResetToken(effectiveId);
      const resetUrl = await buildResetUrl(token);

      // Order matters: do the failable Podio call FIRST. If it throws
      // (e.g. Podio rate-limit / network error), Neon is untouched and
      // any previously-issued reset link the user is still holding stays
      // valid. If we wrote the jti to Neon first and then Podio failed,
      // we'd strand the user with a phantom jti that no email contains —
      // every old link would fail the single-use cross-check, and the
      // new forgot would error before creating the replacement Podio
      // item. (This is exactly the failure mode Jakub hit 2026-05-21.)
      // The Recipient Contact ref stays the duplicate-aware Podio pick
      // (a real, current Podio item) even if the jti row differs.
      await createPasswordResetItem({
        recipientEmail: email,
        contactItemId: contact.podioItemId,
        resetUrl,
        expiresAt,
      });

      // Single-use marker — /reset-password requires the inbound jti
      // to match what's stored here, then clears it on consume. A
      // second /forgot-password request before the first is consumed
      // overwrites the jti, invalidating the older link. UPSERT, not
      // UPDATE: the row is guaranteed to exist afterwards (CCO-T048).
      // The conflict path sets ONLY the jti — never an existing row's
      // hash/email/tier columns.
      await db
        .insert(contacts)
        .values({
          podioItemId: effectiveId,
          email,
          passwordHash: makeResetPendingSentinel(),
          passwordResetJti: jti,
        })
        .onConflictDoUpdate({
          target: contacts.podioItemId,
          set: { passwordResetJti: jti },
        });
    } else {
      // Enumeration-safe branch: still create a Podio item so the
      // outside-visible response shape + timing matches a hit. The
      // workflow's "Recipient Contact blank → Skipped" rule prevents
      // any email from being sent.
      //
      // resetUrl MUST be non-empty: the Podio "Reset URL" field is min-1-char,
      // so createItem 400s on "" — which used to throw and surface the generic
      // "Something went wrong sending the reset link" to every unrecognised
      // email (incl. Thrivecart-migrated members not yet keyed to a Contact,
      // e.g. the 2026-06-22 helpdesk report). This item is Skipped by the
      // workflow (blank Recipient Contact), so the value is never emailed.
      await createPasswordResetItem({
        recipientEmail: email,
        contactItemId: null,
        resetUrl: "https://portal.cco.us/forgot-password",
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000),
      });
    }

    return { sent: true };
  } catch (err) {
    console.error("forgotPasswordAction failed:", err);
    // Detect Podio rate-limit (HTTP 420) so the user gets an honest
    // wait time instead of "try again in a minute" for an hour.
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    // podioFetch throws "Podio rate limited. Retry after Xs" on a 420 — match
    // that wording too (the old check only caught "(420)"/"rate_limit", so a
    // real Podio rate-limit also fell through to the generic message below).
    if (
      lower.includes("(420)") ||
      lower.includes("rate_limit") ||
      lower.includes("rate limited") ||
      lower.includes("retry after")
    ) {
      return {
        error:
          "Our reset service is temporarily rate-limited. Please try again in about 30 minutes.",
      };
    }
    return {
      error:
        "Something went wrong sending the reset link. Please try again in a minute.",
    };
  }
}

// ---------------------------------------------------------------------------
// /reset-password
// ---------------------------------------------------------------------------

/**
 * Submit handler for the reset-password form. Validates the token,
 * cross-checks the jti against the contact row (single-use), writes the
 * new argon2id hash to Neon, clears the jti, and redirects to /sign-in
 * with a success notice.
 *
 * Notes:
 *   - Old sessions ARE intentionally NOT invalidated here. If the user
 *     happens to be signed in elsewhere when they reset, that session
 *     keeps working until its normal expiry. Tradeoff: simpler v1; a
 *     follow-up can add "log out all sessions" if Laureen wants it.
 *   - Podio write-through is deferred to CCO-T038 (locked decision
 *     2026-05-14). Neon-only writes here.
 */
export async function resetPasswordAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirm = formData.get("confirm");

  if (typeof token !== "string" || !token) {
    return { error: "This reset link is invalid. Request a new one." };
  }
  if (typeof password !== "string") {
    return { error: "Please enter a new password." };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }

  let contactId: number;
  let jti: string;
  try {
    ({ contactId, jti } = await verifyResetToken(token));
  } catch (err) {
    console.warn("resetPasswordAction: token verify failed:", (err as Error).message);
    return {
      error:
        "This reset link has expired or is invalid. Request a new one from the sign-in page.",
    };
  }

  // Cross-check single-use marker. A consumed-then-replayed link will
  // fail here even if the JWT is still inside its TTL.
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, contactId),
  });
  if (!contact || contact.passwordResetJti !== jti) {
    return {
      error:
        "This reset link has already been used or was invalidated. Request a new one.",
    };
  }

  // Policy check AFTER the token + jti check so we don't probe the
  // policy as an oracle without a valid link.
  const policyError = await validatePassword(password, { email: contact.email });
  if (policyError) return { error: policyError };

  const newHash = await hashPassword(password);
  await db
    .update(contacts)
    .set({ passwordHash: newHash, passwordResetJti: null })
    .where(eq(contacts.podioItemId, contactId));

  redirect("/sign-in?reset=done");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up the live Contact by email, honouring Mary's Duplicate Status
 * field (CONTACT_FIELDS.DUPLICATE_STATUS, 125701761) so a reset never
 * fires against a flagged duplicate record.
 *
 * Why this skips the Neon mirror:
 *   The mirror is keyed by a UNIQUE email index, so it holds at most one
 *   row per email — even when Podio has duplicates. That row doesn't
 *   currently carry Duplicate Status, so a mirror-hit response can't tell
 *   us whether we'd be resetting an ACTIVE record or a SUSPECTED
 *   DUPLICATE. Forgot-password is a rare event (rate-limited at 5/hr per
 *   IP), so paying one extra Podio call for accurate duplicate handling
 *   is the right trade.
 *
 * Selection rules (locked 2026-05-21 by Jakub):
 *   - Disqualify any Contact whose Duplicate Status is SUSPECTED_DUPLICATE
 *     (4) or CONFIRMED_DUPLICATE (1). Mary's flagged these as non-canonical.
 *   - Among the rest, prefer ACTIVE (3) — that's Mary's "this is the real
 *     record" tag.
 *   - If no ACTIVE match remains, fall back to the first eligible match
 *     (NOT_CHECKED / CHECK_NOW / NO_EMAIL_ADDRESS_TO_CHECK / unset).
 *     These mean "not yet audited" rather than "known bad", so it's safe
 *     to allow a reset through. William can audit afterwards.
 *   - If multiple ACTIVE matches exist (data hygiene incident), log a
 *     warning and use the first one. Future T009 / CCO Member ID work is
 *     the proper fix.
 */
async function findContactByEmail(
  email: string
): Promise<{ podioItemId: number } | null> {
  let items;
  try {
    const result = await filterItems(
      PODIO_APPS.CONTACTS,
      { [CONTACT_FIELDS.EMAIL]: [email] },
      // Realistic upper bound. If a single email is on >25 Contacts, the
      // duplicate situation is bad enough that William should be looking
      // at it directly, not the reset path.
      { limit: 25 }
    );
    items = result.items ?? [];
  } catch (err) {
    console.error("findContactByEmail: Podio filter failed:", err);
    return null;
  }

  if (items.length === 0) return null;

  const DISQUALIFIED = new Set<number>([
    CONTACT_DUPLICATE_STATUS.SUSPECTED_DUPLICATE,
    CONTACT_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
  ]);

  type Eligible = { podioItemId: number; statusId: number | null };
  const eligible: Eligible[] = [];
  for (const item of items) {
    const statusId = getCategoryOptionId(item, CONTACT_FIELDS.DUPLICATE_STATUS);
    if (statusId !== null && DISQUALIFIED.has(statusId)) continue;
    eligible.push({ podioItemId: item.item_id, statusId });
  }

  if (eligible.length === 0) {
    console.warn(
      `findContactByEmail: ${items.length} matches for ${email} but ` +
        `all flagged as SUSPECTED/CONFIRMED DUPLICATE; treating as no match`
    );
    return null;
  }

  // Prefer ACTIVE. Fall back to first eligible non-disqualified.
  const actives = eligible.filter(
    (e) => e.statusId === CONTACT_DUPLICATE_STATUS.ACTIVE
  );
  if (actives.length > 1) {
    console.warn(
      `findContactByEmail: ${actives.length} ACTIVE Contacts share email ` +
        `${email} (data hygiene issue); using item ${actives[0].podioItemId}. ` +
        `IDs: ${actives.map((a) => a.podioItemId).join(", ")}`
    );
  }
  const chosen = actives[0] ?? eligible[0];
  return { podioItemId: chosen.podioItemId };
}

/**
 * Best-effort client IP from request headers. On Vercel, `x-forwarded-for`
 * is set by the edge and is trustworthy (we're not behind a customer-
 * configurable reverse proxy). May be a comma-separated list; first entry
 * is the original client. Falls back to "unknown" if absent so the
 * rate-limiter bucket key is still stable.
 */
async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const xff = hdrs.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return hdrs.get("x-real-ip") ?? "unknown";
}

async function buildResetUrl(token: string): Promise<string> {
  // Derive the base URL from the incoming request headers rather than an
  // env var. Earlier attempts using `NEXT_PUBLIC_BASE_URL` and then plain
  // `BASE_URL` both leaked a local-dev value (`http://localhost:3000`)
  // into the production deploy via the various .env precedence rules of
  // `vercel --prod` + Next.js — see CONTINUITY.md "two Vercel .env
  // footguns" postmortem.
  //
  // Headers route is robust: localhost on `npm run dev`, cco-platform.vercel.app
  // on prod, future custom domain automatically — all without any env var.
  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "cco-platform.vercel.app";
  // x-forwarded-proto is set by Vercel's edge to "https" in prod; on local
  // dev there's no x-forwarded-proto and `host` is "localhost:3000", so
  // we want "http" there. Default to "http" when the host is loopback.
  const inferredProto =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  const proto = hdrs.get("x-forwarded-proto") ?? inferredProto;
  return `${proto}://${host}/reset-password?token=${encodeURIComponent(token)}`;
}
