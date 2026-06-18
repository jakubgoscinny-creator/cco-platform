import { describe, it, expect } from "vitest";
import {
  isActiveSubscriber,
  normalizeAccessTier,
  canAccessTest,
  isEnrolledStudent,
  isStudentTestMisconfigured,
  catalogTreatment,
  ACTIVE_SUBSCRIBER_STATUSES,
  isEntitledTrackerStatus,
  TEARDOWN_TRACKER_STATUS_IDS,
} from "./circle-access";

// ---------------------------------------------------------------------------
// Test fixtures — the three audiences from the T033 acceptance matrix.
// ---------------------------------------------------------------------------

const nonSubscriber = { subscriptionStatus: null, enrolledTrackerTypes: [] };
const clubOnly = {
  subscriptionStatus: "Active Annual",
  enrolledTrackerTypes: [],
};
const pbcStudent = {
  subscriptionStatus: null,
  enrolledTrackerTypes: ["PBC"],
};
const pbcStudentAlsoClub = {
  subscriptionStatus: "Monthly",
  enrolledTrackerTypes: ["PBC"],
};

const freeTest = { accessTier: "Free", studentTrackerType: null };
const clubTest = { accessTier: "Club", studentTrackerType: null };
const memberTest = { accessTier: "Member", studentTrackerType: null }; // legacy
const untaggedTest = { accessTier: null, studentTrackerType: null };
const pbcTest = { accessTier: "Student", studentTrackerType: "PBC" };
const ipcTest = { accessTier: "Student", studentTrackerType: "IPC" };
const brokenStudentTest = { accessTier: "Student", studentTrackerType: null };

describe("isActiveSubscriber", () => {
  it("accepts every one of Mary's canonical active statuses", () => {
    for (const status of ACTIVE_SUBSCRIBER_STATUSES) {
      expect(isActiveSubscriber(status)).toBe(true);
    }
  });

  it("rejects null, empty, and unknown statuses", () => {
    expect(isActiveSubscriber(null)).toBe(false);
    expect(isActiveSubscriber(undefined)).toBe(false);
    expect(isActiveSubscriber("")).toBe(false);
    expect(isActiveSubscriber("Cancelled")).toBe(false);
    expect(isActiveSubscriber("Expired")).toBe(false);
    expect(isActiveSubscriber("Monthly ")).toBe(false); // exact match only
  });
});

describe("normalizeAccessTier", () => {
  it("maps the three tiers to themselves", () => {
    expect(normalizeAccessTier("Free")).toBe("Free");
    expect(normalizeAccessTier("Club")).toBe("Club");
    expect(normalizeAccessTier("Student")).toBe("Student");
  });

  it("maps the legacy T006 'Member' option to Club", () => {
    expect(normalizeAccessTier("Member")).toBe("Club");
  });

  it("maps Mary's actual 'Club Member' Podio option label to Club", () => {
    expect(normalizeAccessTier("Club Member")).toBe("Club");
  });

  it("fails closed to Club for null/empty/unknown (never Free)", () => {
    expect(normalizeAccessTier(null)).toBe("Club");
    expect(normalizeAccessTier(undefined)).toBe("Club");
    expect(normalizeAccessTier("")).toBe("Club");
    expect(normalizeAccessTier("free")).toBe("Club"); // case-sensitive: not "Free"
    expect(normalizeAccessTier("garbage")).toBe("Club");
  });
});

describe("canAccessTest — Free tier", () => {
  it("is allowed for every audience", () => {
    expect(canAccessTest(freeTest, nonSubscriber)).toBe("allowed");
    expect(canAccessTest(freeTest, clubOnly)).toBe("allowed");
    expect(canAccessTest(freeTest, pbcStudent)).toBe("allowed");
    expect(canAccessTest(freeTest, pbcStudentAlsoClub)).toBe("allowed");
  });
});

describe("canAccessTest — Club tier", () => {
  it("allows active subscribers, blocks everyone else", () => {
    expect(canAccessTest(clubTest, clubOnly)).toBe("allowed");
    expect(canAccessTest(clubTest, pbcStudentAlsoClub)).toBe("allowed");
    expect(canAccessTest(clubTest, nonSubscriber)).toBe("members_only");
    // An enrolled student who is NOT a subscriber does not get Club tests.
    expect(canAccessTest(clubTest, pbcStudent)).toBe("members_only");
  });

  it("treats the legacy 'Member' tier exactly like Club", () => {
    expect(canAccessTest(memberTest, clubOnly)).toBe("allowed");
    expect(canAccessTest(memberTest, nonSubscriber)).toBe("members_only");
  });

  it("treats an untagged test as Club (fail-closed)", () => {
    expect(canAccessTest(untaggedTest, clubOnly)).toBe("allowed");
    expect(canAccessTest(untaggedTest, nonSubscriber)).toBe("members_only");
    expect(canAccessTest(untaggedTest, pbcStudent)).toBe("members_only");
  });
});

describe("canAccessTest — Student tier", () => {
  it("allows a student whose enrollment matches the test's tracker type", () => {
    expect(canAccessTest(pbcTest, pbcStudent)).toBe("allowed");
    expect(canAccessTest(pbcTest, pbcStudentAlsoClub)).toBe("allowed");
  });

  it("matches tracker types case-insensitively", () => {
    expect(
      canAccessTest(pbcTest, { subscriptionStatus: null, enrolledTrackerTypes: ["pbc"] })
    ).toBe("allowed");
    expect(
      canAccessTest(
        { accessTier: "Student", studentTrackerType: " pbc " },
        { subscriptionStatus: null, enrolledTrackerTypes: ["PBC"] }
      )
    ).toBe("allowed");
  });

  it("blocks a student enrolled in a different course", () => {
    expect(canAccessTest(ipcTest, pbcStudent)).toBe("members_only");
  });

  it("blocks non-students even if they are active subscribers (no stacking grant)", () => {
    expect(canAccessTest(pbcTest, clubOnly)).toBe("members_only");
    expect(canAccessTest(pbcTest, nonSubscriber)).toBe("members_only");
  });

  it("blocks when enrolledTrackerTypes is missing/empty", () => {
    expect(canAccessTest(pbcTest, { subscriptionStatus: null })).toBe("members_only");
    expect(
      canAccessTest(pbcTest, { subscriptionStatus: null, enrolledTrackerTypes: [] })
    ).toBe("members_only");
  });

  it("fails closed for a Student test with no tracker type (admin error) — blocked for everyone", () => {
    expect(canAccessTest(brokenStudentTest, pbcStudent)).toBe("members_only");
    expect(canAccessTest(brokenStudentTest, pbcStudentAlsoClub)).toBe("members_only");
    expect(canAccessTest(brokenStudentTest, clubOnly)).toBe("members_only");
  });
});

describe("isEntitledTrackerStatus (CCO-T056c)", () => {
  it("treats unknown/null/undefined status as entitled (fail-open)", () => {
    expect(isEntitledTrackerStatus(null)).toBe(true);
    expect(isEntitledTrackerStatus(undefined)).toBe(true);
  });

  it("counts every active/ambiguous enrollment status — never locks out", () => {
    // 1 Active, 2 On Hold, 3 Lost Sheep, 4 Inactive/Unresponsive, 6 F&F,
    // 7 Complimentary, 8 Graduated, 9 Error, 10 Club Ad Hoc, 13 No Coaching.
    for (const id of [1, 2, 3, 4, 6, 7, 8, 9, 10, 13]) {
      expect(isEntitledTrackerStatus(id)).toBe(true);
    }
  });

  it("excludes ONLY the four positively-known teardown statuses", () => {
    // 5 Dropped/Refunded, 11 Suspended/Billing Failure,
    // 12 Expired/Not Club Member, 14 Course Subscription Canceled.
    for (const id of [5, 11, 12, 14]) {
      expect(isEntitledTrackerStatus(id)).toBe(false);
      expect(TEARDOWN_TRACKER_STATUS_IDS.has(id)).toBe(true);
    }
  });

  it("the teardown set is exactly those four ids (guards against scope creep)", () => {
    expect([...TEARDOWN_TRACKER_STATUS_IDS].sort((a, b) => a - b)).toEqual([
      5, 11, 12, 14,
    ]);
  });
});

describe("isStudentTestMisconfigured", () => {
  it("flags a Student test with no tracker type", () => {
    expect(isStudentTestMisconfigured(brokenStudentTest)).toBe(true);
    expect(isStudentTestMisconfigured({ accessTier: "Student", studentTrackerType: "" })).toBe(true);
  });

  it("does not flag a properly tagged Student test or non-Student tiers", () => {
    expect(isStudentTestMisconfigured(pbcTest)).toBe(false);
    expect(isStudentTestMisconfigured(freeTest)).toBe(false);
    expect(isStudentTestMisconfigured(clubTest)).toBe(false);
  });
});

describe("isEnrolledStudent", () => {
  it("is true only when the contact has at least one tracker type", () => {
    expect(isEnrolledStudent(pbcStudent)).toBe(true);
    expect(isEnrolledStudent(pbcStudentAlsoClub)).toBe(true);
    expect(isEnrolledStudent(clubOnly)).toBe(false);
    expect(isEnrolledStudent(nonSubscriber)).toBe(false);
    expect(isEnrolledStudent({})).toBe(false);
    expect(isEnrolledStudent({ enrolledTrackerTypes: null })).toBe(false);
  });
});

describe("catalogTreatment", () => {
  it("shows takeable tests to everyone", () => {
    expect(catalogTreatment(freeTest, nonSubscriber)).toBe("show");
    expect(catalogTreatment(clubTest, clubOnly)).toBe("show");
    expect(catalogTreatment(pbcTest, pbcStudent)).toBe("show");
  });

  it("shows a Club lock badge to non-subscriber non-students (the upsell)", () => {
    expect(catalogTreatment(clubTest, nonSubscriber)).toBe("locked");
    expect(catalogTreatment(memberTest, nonSubscriber)).toBe("locked");
    expect(catalogTreatment(untaggedTest, nonSubscriber)).toBe("locked");
  });

  it("CCO-T044: HIDES Student-tier course exams from anyone not enrolled (no misleading club lock)", () => {
    expect(catalogTreatment(pbcTest, nonSubscriber)).toBe("hidden");
    expect(catalogTreatment(pbcTest, clubOnly)).toBe("hidden");
    // enrolled, but in a different course:
    expect(catalogTreatment(ipcTest, pbcStudent)).toBe("hidden");
    // Student test with no tracker type (admin error) is also hidden, not locked:
    expect(catalogTreatment(brokenStudentTest, clubOnly)).toBe("hidden");
  });

  it("hides Club tests from enrolled students who can't take them (only-own view)", () => {
    expect(catalogTreatment(clubTest, pbcStudent)).toBe("hidden");
  });

  it("a student who is also a subscriber sees their student tests AND club tests", () => {
    expect(catalogTreatment(pbcTest, pbcStudentAlsoClub)).toBe("show");
    expect(catalogTreatment(clubTest, pbcStudentAlsoClub)).toBe("show");
  });
});
