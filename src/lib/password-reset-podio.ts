/**
 * Create a "Password Resets" Podio item (CCO-T031).
 *
 * App stood up via cco-platform/scripts/podio-create-password-resets-app.py
 * on 2026-05-21:
 *   - app_id 30739071 (space 10191082 / CCO-Portal)
 *   - field IDs frozen below; see snapshots/password-resets-app.json
 *
 * Workflow (owned by Mary) listens on item-create:
 *   - If `Recipient Contact` (recipient-profile) is set → email the address
 *     in `Recipient Email` with the body containing `Reset URL`. Then set
 *     `Status` → Sent (or Failed on send error).
 *   - If `Recipient Contact` is blank → set `Status` → Skipped and DO NOT
 *     send. This is how the portal preserves enumeration-safe behaviour
 *     for /forgot-password against unknown emails: we still create the
 *     Podio item so timing looks identical to a hit, but the workflow
 *     intentionally drops it on the floor.
 */

import { createItem } from "./podio";

export const PASSWORD_RESETS_APP_ID = 30739071;

export const PASSWORD_RESET_FIELDS = {
  RECIPIENT_EMAIL: 277002644,
  /**
   * External id `recipient-profile` (Podio stripped `-ref` on create).
   * Label is "Recipient Contact"; reference target is the Contacts app
   * (14660191, in -CCO Main Hub) — matches the live auth.ts credential
   * path.
   */
  RECIPIENT_CONTACT: 277002645,
  RESET_URL: 277002646,
  EXPIRES_AT: 277002647,
  STATUS: 277002648,
  USED_AT: 277002649,
} as const;

export const PASSWORD_RESET_STATUS = {
  PENDING: 1,
  SENT: 2,
  SKIPPED: 3,
  FAILED: 4,
} as const;

// Podio dates use "YYYY-MM-DD HH:MM:SS" (UTC), not ISO 8601 with T/Z.
// Same convention as actions/exam.ts.
function podioDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

/**
 * Create a Password Resets item.
 *
 * Pass `contactItemId` for known recipients (workflow will send the email).
 * Pass `null` for unknown emails (workflow will mark Skipped). Either way
 * the portal hands back a 200, so the response time looks identical from
 * the outside.
 */
export async function createPasswordResetItem(args: {
  recipientEmail: string;
  contactItemId: number | null;
  resetUrl: string;
  expiresAt: Date;
}): Promise<{ item_id: number }> {
  const fields: Record<string, unknown> = {
    [PASSWORD_RESET_FIELDS.RECIPIENT_EMAIL]: [
      { value: args.recipientEmail, type: "other" },
    ],
    [PASSWORD_RESET_FIELDS.RESET_URL]: args.resetUrl,
    [PASSWORD_RESET_FIELDS.EXPIRES_AT]: { start: podioDate(args.expiresAt) },
    [PASSWORD_RESET_FIELDS.STATUS]: PASSWORD_RESET_STATUS.PENDING,
  };

  if (args.contactItemId !== null) {
    // App-reference fields take a single item_id or an array. Array form
    // matches the convention in actions/exam.ts.
    fields[PASSWORD_RESET_FIELDS.RECIPIENT_CONTACT] = [args.contactItemId];
  }

  return createItem(PASSWORD_RESETS_APP_ID, fields);
}
