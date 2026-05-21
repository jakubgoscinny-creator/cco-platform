"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { hashPassword } from "@/lib/password";
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
  PODIO_APPS,
  CONTACT_FIELDS,
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
  const email = rawEmail.toLowerCase().trim();

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
    const contact = await findContactByEmail(email);

    if (contact) {
      const { token, jti, expiresAt } = await signResetToken(contact.podioItemId);
      const resetUrl = await buildResetUrl(token);

      // Order matters: do the failable Podio call FIRST. If it throws
      // (e.g. Podio rate-limit / network error), Neon is untouched and
      // any previously-issued reset link the user is still holding stays
      // valid. If we wrote the jti to Neon first and then Podio failed,
      // we'd strand the user with a phantom jti that no email contains —
      // every old link would fail the single-use cross-check, and the
      // new forgot would error before creating the replacement Podio
      // item. (This is exactly the failure mode Jakub hit 2026-05-21.)
      await createPasswordResetItem({
        recipientEmail: email,
        contactItemId: contact.podioItemId,
        resetUrl,
        expiresAt,
      });

      // Single-use marker — /reset-password requires the inbound jti
      // to match what's stored here, then clears it on consume. A
      // second /forgot-password request before the first is consumed
      // overwrites the jti, invalidating the older link.
      await db
        .update(contacts)
        .set({ passwordResetJti: jti })
        .where(eq(contacts.podioItemId, contact.podioItemId));
    } else {
      // Enumeration-safe branch: still create a Podio item so the
      // outside-visible response shape + timing matches a hit. The
      // workflow's "Recipient Contact blank → Skipped" rule prevents
      // any email from being sent.
      await createPasswordResetItem({
        recipientEmail: email,
        contactItemId: null,
        resetUrl: "",
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000),
      });
    }

    return { sent: true };
  } catch (err) {
    console.error("forgotPasswordAction failed:", err);
    // Detect Podio rate-limit (HTTP 420) so the user gets an honest
    // wait time instead of "try again in a minute" for an hour.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("(420)") || msg.toLowerCase().includes("rate_limit")) {
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
 * Look up the live Contact by email. We hit Podio (not the Neon mirror)
 * so accounts that have never signed in still receive a reset link.
 * `fetchContactFromPodio` in auth.ts upserts the mirror on hit; we mirror
 * just enough of that here without exposing internal helpers.
 */
async function findContactByEmail(
  email: string
): Promise<{ podioItemId: number } | null> {
  // Mirror first — cheap path for repeat resets.
  const mirror = await db.query.contacts.findFirst({
    where: eq(contacts.email, email),
    columns: { podioItemId: true },
  });
  if (mirror) return mirror;

  // Podio fallback — email field on Contacts is type "email"; filter takes
  // a string array (see auth.ts fetchContactFromPodio for the same pattern).
  try {
    const result = await filterItems(
      PODIO_APPS.CONTACTS,
      { [CONTACT_FIELDS.EMAIL]: [email] },
      { limit: 1 }
    );
    const item = result.items?.[0];
    if (!item) return null;
    return { podioItemId: item.item_id };
  } catch (err) {
    console.error("findContactByEmail: Podio filter failed:", err);
    return null;
  }
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
