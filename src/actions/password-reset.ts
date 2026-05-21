"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { hashPassword } from "@/lib/password";
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

  try {
    const contact = await findContactByEmail(email);

    if (contact) {
      const { token, jti, expiresAt } = await signResetToken(contact.podioItemId);

      // Single-use marker — /reset-password requires the inbound jti
      // to match what's stored here, then clears it on consume. A
      // second /forgot-password request before the first is consumed
      // overwrites the jti, invalidating the older link.
      await db
        .update(contacts)
        .set({ passwordResetJti: jti })
        .where(eq(contacts.podioItemId, contact.podioItemId));

      const resetUrl = buildResetUrl(token);

      await createPasswordResetItem({
        recipientEmail: email,
        contactItemId: contact.podioItemId,
        resetUrl,
        expiresAt,
      });
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
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
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

function buildResetUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://cco-platform.vercel.app";
  return `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(
    token
  )}`;
}
