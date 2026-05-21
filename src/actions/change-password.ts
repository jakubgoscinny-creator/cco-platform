"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { getSessionContact } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validatePassword } from "@/lib/password-policy";

/**
 * Authenticated change-password action (CCO-T031 Phase 2).
 *
 * Differences vs the reset flow:
 *   - Requires a current session.
 *   - Requires the OLD password — verified via the shared verifier
 *     ladder so users on a legacy plaintext/MD5/bcrypt hash can change
 *     to argon2id without first going through the reset flow.
 *   - Writes argon2id to Neon. Podio's PASSWORD_MASTER stays untouched
 *     (T038 covers the write-through gap).
 *   - Sessions are NOT invalidated. If the user is signed in on
 *     another device, that session continues until its normal expiry.
 *     Matches the reset behaviour for now; "sign out everywhere" is
 *     a follow-up if Laureen wants it.
 */
export async function changePasswordAction(
  _prevState: { done?: boolean; error?: string } | null,
  formData: FormData
): Promise<{ done?: boolean; error?: string } | null> {
  const session = await getSessionContact();
  if (!session) {
    return { error: "Your session has expired. Please sign in again." };
  }

  const current = formData.get("current");
  const next = formData.get("next");
  const confirm = formData.get("confirm");

  if (typeof current !== "string" || !current) {
    return { error: "Please enter your current password." };
  }
  if (typeof next !== "string") {
    return { error: "Please enter a new password." };
  }
  if (next !== confirm) {
    return { error: "The two new passwords don't match." };
  }

  // Verify current password against Neon's stored hash. Uses the same
  // multi-algo ladder auth.ts uses, so legacy plaintext / MD5 / bcrypt
  // accounts can change to argon2id without first going through reset.
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, session.contactId),
    columns: { podioItemId: true, email: true, passwordHash: true },
  });
  if (!contact) {
    return { error: "Your account record could not be found. Please sign in again." };
  }
  const currentMatches = await verifyPassword(current, contact.passwordHash);
  if (!currentMatches) {
    return { error: "Current password is incorrect." };
  }

  // Apply the shared policy with old-password context so we reject
  // trivial variants (e.g. appending "1" to the old one).
  const policyError = await validatePassword(next, {
    email: contact.email,
    oldPassword: current,
  });
  if (policyError) return { error: policyError };

  const newHash = await hashPassword(next);
  await db
    .update(contacts)
    .set({ passwordHash: newHash, passwordResetJti: null })
    .where(eq(contacts.podioItemId, contact.podioItemId));

  return { done: true };
}
