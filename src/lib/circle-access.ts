/**
 * CCO-T006: Freemium gating via per-test access tier + Contacts.SUBSCRIPTION_STATUS.
 *
 * Source-of-truth decisions (locked 2026-05-14 with Jakub):
 * - Active-subscriber values: only the 4 statuses Mary uses to mark current
 *   paying members. Anything else (including null / empty) is non-subscriber.
 * - Per-test tier: Podio category field "access-tier" on Tests app (16243239),
 *   options "Free" / "Member". Sync defaults untagged tests to "Member"
 *   (fail-closed — see sync.ts mapPodioTest).
 * - Gating layers: catalog (UX), /exam/start (clear block), attempt-create
 *   server action (integrity boundary). All three are needed.
 */
export const ACTIVE_SUBSCRIBER_STATUSES: ReadonlySet<string> = new Set([
  "Monthly (Grandfathered)",
  "Monthly (26)",
  "Active Annual",
  "Monthly",
]);

export type AccessTier = "Free" | "Member";

export type AccessDecision = "allowed" | "members_only";

/**
 * A Contact is an active subscriber iff their SUBSCRIPTION_STATUS exactly
 * matches one of Mary's canonical active values. Null / empty / unknown
 * values are non-subscriber by default.
 */
export function isActiveSubscriber(
  subscriptionStatus: string | null | undefined
): boolean {
  if (!subscriptionStatus) return false;
  return ACTIVE_SUBSCRIBER_STATUSES.has(subscriptionStatus);
}

/**
 * Coerce a raw access_tier string (from Neon or Podio) to a typed AccessTier.
 * Anything other than "Free" defaults to "Member" (fail-closed).
 */
export function normalizeAccessTier(raw: string | null | undefined): AccessTier {
  return raw === "Free" ? "Free" : "Member";
}

/**
 * Gate decision for a single (test, contact) pair.
 *
 * - Free-tier tests are always allowed (for signed-in users; auth wall is
 *   the layer above).
 * - Member-tier tests are allowed only for active subscribers.
 */
export function canAccessTest(
  test: { accessTier: string | null | undefined },
  contact: { subscriptionStatus: string | null | undefined }
): AccessDecision {
  const tier = normalizeAccessTier(test.accessTier);
  if (tier === "Free") return "allowed";
  return isActiveSubscriber(contact.subscriptionStatus) ? "allowed" : "members_only";
}
