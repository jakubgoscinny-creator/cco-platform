/**
 * CCO-T006 + CCO-T033: per-test access gating.
 *
 * T006 shipped Free / Member gating off Contacts.SUBSCRIPTION_STATUS.
 * T033 (design resolved 2026-05-29) extends the tier model to
 * Free / Club / Student and adds the Student dimension — a per-test
 * "progress tracker type" matched against the tracker types the Contact is
 * actually enrolled in (resolved from the Podio Progress Tracker app
 * 16163523 and mirrored to Neon at sign-in, like subscription_status).
 *
 * Source-of-truth decisions (locked 2026-05-29 with Jakub):
 * - **v1 is Podio-only.** No Circle API call on the gating path: no Circle API
 *   token exists (the SSO signer only signs HS256 JWTs). Every decision below
 *   is made from Neon-mirrored Podio data, so a Circle outage cannot affect
 *   access — there is no Circle dependency to fail.
 * - Active-subscriber values: only the 4 statuses Mary uses to mark current
 *   paying members. Anything else (including null / empty) is non-subscriber.
 * - Per-test tier: Podio category field "access-tier" on Tests (16243239),
 *   options Free / Club / Student. Legacy "Member" (the T006 option) === Club.
 *   Untagged / unknown defaults to Club (fail-closed — never Free; this is
 *   exactly the T006 Member default extended to the new options, so existing
 *   untagged tests keep their "locked to non-subscribers" behavior rather than
 *   silently becoming Student-locked-to-everyone).
 * - Tiers STACK: a Contact who is both an active subscriber AND an enrolled
 *   student sees Club tests AND their Student tests. Club membership does NOT
 *   grant Student tests, and course enrollment does NOT grant Club tests.
 * - Gating layers (unchanged from T006): catalog (UX), /exam/start (block),
 *   startExamAction (server integrity boundary). All three call canAccessTest.
 */
export const ACTIVE_SUBSCRIBER_STATUSES: ReadonlySet<string> = new Set([
  "Monthly (Grandfathered)",
  "Monthly (26)",
  "Active Annual",
  "Monthly",
]);

export type AccessTier = "Free" | "Club" | "Student";

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
 * - "Free" / "Club" / "Student" map to themselves.
 * - "Member" (the T006 option, pre-T033) maps to Club.
 * - Anything else (null / empty / unknown) defaults to Club — fail-closed:
 *   never Free, so nothing leaks to non-subscribers without explicit intent.
 */
export function normalizeAccessTier(raw: string | null | undefined): AccessTier {
  switch (raw) {
    case "Free":
      return "Free";
    case "Student":
      return "Student";
    case "Club":
    case "Club Member": // the actual Podio option label on the access-tier field
    case "Member": // legacy T006 option — Member tier === Club
      return "Club";
    default:
      return "Club"; // fail-closed
  }
}

import { parseTrackerType } from "./test-categories";

/** Normalize a progress-tracker-type token for comparison (trim + upper). */
function normalizeTrackerType(t: string | null | undefined): string {
  return (t ?? "").trim().toUpperCase();
}

/**
 * CCO-T056c: PT Overall Status (field 149529784) option IDs that POSITIVELY
 * mean a student's enrollment has ended — billing failure, expiry, refund/drop,
 * or cancellation. A Progress Tracker in one of these states must NOT grant the
 * Student-tier exams for its course (the "cut off expired students" ask).
 *
 * IDs (not labels) are used so a Podio relabel can't silently change gating.
 * Captured from snapshots/progress-tracker-app.json:
 *   5  Dropped / Refunded
 *   11 Subscription Suspended / Billing Failure
 *   12 Subscription Expired / Not Club Member
 *   14 Course Subscription Canceled
 * Everything else (Enrolled - *, Club Member - Ad Hoc, Graduated, Error,
 * On Hold, Lost Sheep, Inactive, …) is treated as STILL-ENTITLED — fail-open.
 */
export const TEARDOWN_TRACKER_STATUS_IDS: ReadonlySet<number> = new Set([
  5, 11, 12, 14,
]);

/**
 * Is this PT Overall Status option id a still-entitled enrollment?
 *
 * Fail-open by design: ONLY a known teardown id returns false. null / unknown /
 * any other id returns true (count the enrollment), preserving the v1
 * "never lock out an active student on missing or ambiguous status" safeguard
 * (CCO-T033 podio.ts:361). Deny only on PROVEN-bad.
 */
export function isEntitledTrackerStatus(
  overallStatusId: number | null | undefined
): boolean {
  if (overallStatusId == null) return true; // unknown → grant
  return !TEARDOWN_TRACKER_STATUS_IDS.has(overallStatusId);
}

/**
 * True if the Contact is enrolled in at least one course (has any progress
 * tracker types). Drives the catalog presentation split: enrolled students
 * see only the tests they can actually take; everyone else keeps the T006
 * show-all-with-locks catalog.
 */
export function isEnrolledStudent(contact: {
  enrolledTrackerTypes?: readonly string[] | null | undefined;
}): boolean {
  return (contact.enrolledTrackerTypes?.length ?? 0) > 0;
}

/**
 * Does the Contact's enrollment cover this test's student tracker type?
 * A Student test with no tracker type never matches (fail-closed); that case
 * is an admin error surfaced by isStudentTestMisconfigured.
 */
function studentEnrollmentMatches(
  testTrackerType: string | null | undefined,
  enrolledTrackerTypes: readonly string[] | null | undefined
): boolean {
  const want = normalizeTrackerType(testTrackerType);
  if (!want) return false; // Student test with no tracker type → never matches
  if (!enrolledTrackerTypes?.length) return false;

  // 1) Exact match — an individual enrollment (incl. an individual gemstone PT
  //    like "PBC PE - Ruby"). Unchanged from T033.
  if (enrolledTrackerTypes.some((t) => normalizeTrackerType(t) === want)) {
    return true;
  }

  // 2) CCO-T088 bundle expansion (safety net). A bundle purchase currently
  //    lands as a SINGLE tracker type that names the bundle, e.g.
  //    "PBC PE Bundle (Ruby, Sapphire, Topaz)" — which matches none of the
  //    individual test tracker types, so a paying bundle buyer would otherwise
  //    see their exams padlocked. Grant a bundle enrollment access to every
  //    test of the SAME course + category.
  //
  //    Narrow by construction — it can't over-grant:
  //      · only a bundle enrollment (isBundle) ever expands;
  //      · only to its own course AND category;
  //      · a test with no derivable category (course-module content) is never
  //        matched (the guard below), so a PE bundle can't leak into a course.
  //    Long-term the Podio side should create 3 individual PTs per bundle (6/25
  //    call decision); this keeps existing bundle buyers working meanwhile.
  const test = parseTrackerType(testTrackerType);
  if (!test.course || !test.category) return false;
  return enrolledTrackerTypes.some((t) => {
    const e = parseTrackerType(t);
    return (
      e.isBundle && e.course === test.course && e.category === test.category
    );
  });
}

/**
 * A Student-tier test with no progress-tracker type is an admin-time error:
 * it can never unlock for anyone. Callers can flag it (T033 acceptance
 * criterion) without changing the fail-closed access result.
 */
export function isStudentTestMisconfigured(test: {
  accessTier: string | null | undefined;
  studentTrackerType?: string | null | undefined;
}): boolean {
  return (
    normalizeAccessTier(test.accessTier) === "Student" &&
    !normalizeTrackerType(test.studentTrackerType)
  );
}

/**
 * Gate decision for a single (test, contact) pair. The integrity primitive
 * used by all three gating layers.
 *
 * - Free    → always allowed (the auth wall is the layer above).
 * - Club    → allowed only for active subscribers.
 * - Student → allowed only when the test's tracker type is one the Contact is
 *   enrolled in. Independent of Club: tiers stack, neither grants the other.
 */
export function canAccessTest(
  test: {
    accessTier: string | null | undefined;
    studentTrackerType?: string | null | undefined;
  },
  contact: {
    subscriptionStatus: string | null | undefined;
    enrolledTrackerTypes?: readonly string[] | null | undefined;
  }
): AccessDecision {
  const tier = normalizeAccessTier(test.accessTier);
  switch (tier) {
    case "Free":
      return "allowed";
    case "Club":
      return isActiveSubscriber(contact.subscriptionStatus)
        ? "allowed"
        : "members_only";
    case "Student":
      return studentEnrollmentMatches(
        test.studentTrackerType,
        contact.enrolledTrackerTypes
      )
        ? "allowed"
        : "members_only";
  }
}

export type CatalogTreatment = "show" | "locked" | "hidden";

/**
 * How a test should appear in the catalog for a given Contact.
 * Decision history: CCO-T033 5/21 (students see only-own) + CCO-T044 2026-05-28
 * (catalog expanded 10 → ~253 via Ready-for-Portal, now mostly Student course
 * exams). Refined rule:
 * - allowed                    → "show"   (normal card).
 * - Student-tier, not allowed  → "hidden" for EVERYONE — a "Join CCO Club" lock
 *   on a course chapter exam is misleading (joining the club doesn't unlock
 *   course content; you enrol in the course). Keeps the catalog clean.
 * - Club-tier, not allowed     → "locked" for non-students (the correct "Join
 *   CCO Club" upsell), "hidden" for enrolled students (only-own view).
 *
 * Net: a non-enrolled user sees Free/CEU + Club tests (locked if not a
 * subscriber); an enrolled student sees Free/CEU + their own course's tests
 * (+ Club tests if also a subscriber) and nothing they can't take.
 *
 * "CEUs always visible to everyone" is satisfied by Mary modelling the free
 * CEU quizzes as Free tier (→ "show" for all).
 */
export function catalogTreatment(
  test: {
    accessTier: string | null | undefined;
    studentTrackerType?: string | null | undefined;
  },
  contact: {
    subscriptionStatus: string | null | undefined;
    enrolledTrackerTypes?: readonly string[] | null | undefined;
  }
): CatalogTreatment {
  if (canAccessTest(test, contact) === "allowed") return "show";
  // Not allowed: hide Student-tier course exams from non-enrolled users (a club
  // lock on course content misleads); keep Club-tier as a lock-badge upsell for
  // non-students, hidden for enrolled students (only-own view).
  if (normalizeAccessTier(test.accessTier) === "Student") return "hidden";
  return isEnrolledStudent(contact) ? "hidden" : "locked";
}
