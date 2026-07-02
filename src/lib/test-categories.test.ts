import { describe, it, expect } from "vitest";
import {
  classifyTestCategory,
  parseTrackerType,
  deriveCourseKey,
  courseGroupTitle,
  courseBadgeLabel,
  TEST_CATEGORY_LABELS,
  type TestCategory,
} from "./test-categories";

describe("classifyTestCategory — Mary's re-tagged (6/25) clean values", () => {
  it("maps the clean single-category values", () => {
    expect(classifyTestCategory("Blitz")).toBe("blitz");
    expect(classifyTestCategory("Practice Exam")).toBe("practice_exam");
  });

  it("is tolerant of case and surrounding whitespace", () => {
    expect(classifyTestCategory("  blitz ")).toBe("blitz");
    expect(classifyTestCategory("PRACTICE EXAM")).toBe("practice_exam");
    expect(classifyTestCategory("practice exams")).toBe("practice_exam");
  });
});

describe("classifyTestCategory — combined fallback (untagged / reverted)", () => {
  it("keeps the old combined value working as a fallback bucket", () => {
    expect(classifyTestCategory("Blitz/Practice Exam")).toBe(
      "blitz_practice_combo"
    );
    expect(classifyTestCategory("Blitz / Practice Exam")).toBe(
      "blitz_practice_combo"
    );
    expect(classifyTestCategory("practice exam / blitz")).toBe(
      "blitz_practice_combo"
    );
  });
});

describe("classifyTestCategory — non-Blitz/PE categories are not bucketed", () => {
  it("returns null so these keep grouping by course code / tier", () => {
    expect(classifyTestCategory("Course Module")).toBeNull();
    expect(classifyTestCategory("CEU Quiz")).toBeNull();
    expect(classifyTestCategory("Domain Pool")).toBeNull();
    expect(classifyTestCategory("Other")).toBeNull();
  });

  it("returns null for empty / missing values", () => {
    expect(classifyTestCategory(null)).toBeNull();
    expect(classifyTestCategory(undefined)).toBeNull();
    expect(classifyTestCategory("")).toBeNull();
    expect(classifyTestCategory("   ")).toBeNull();
  });

  it("does not misclassify a substring match as blitz/practice", () => {
    expect(classifyTestCategory("Blitzkrieg Trivia")).toBeNull();
    expect(classifyTestCategory("Practice Management")).toBeNull();
  });
});

describe("TEST_CATEGORY_LABELS", () => {
  it("has a heading for every category bucket", () => {
    const categories: TestCategory[] = [
      "blitz",
      "practice_exam",
      "blitz_practice_combo",
    ];
    for (const c of categories) {
      expect(TEST_CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});

describe("parseTrackerType — practice-exam gemstones (live data shapes)", () => {
  it("derives the course + practice_exam from gemstone tracker types", () => {
    // Real values incl. their inconsistent spacing.
    for (const t of [
      "PBC PE  -  Ruby",
      "PBC PE  - Topaz",
      "PBC PE  -  Sapphire",
    ]) {
      expect(parseTrackerType(t)).toEqual({
        course: "PBC",
        category: "practice_exam",
        isBundle: false,
      });
    }
    expect(parseTrackerType("IPC PE  -  Onyx").course).toBe("IPC");
    expect(parseTrackerType("PBB PE - Tanzanite").course).toBe("PBB");
    expect(parseTrackerType("ICD10G PE - Peridot")).toEqual({
      course: "ICD10G",
      category: "practice_exam",
      isBundle: false,
    });
  });

  it("folds a Trial practice exam into its course", () => {
    expect(parseTrackerType("Trial PBC PE")).toEqual({
      course: "PBC",
      category: "practice_exam",
      isBundle: false,
    });
    expect(parseTrackerType("Trial PBB PE").course).toBe("PBB");
  });
});

describe("parseTrackerType — review blitzes", () => {
  it("derives the course + blitz, tolerating the missing space", () => {
    expect(parseTrackerType("FBC - Review Blitz")).toEqual({
      course: "FBC",
      category: "blitz",
      isBundle: false,
    });
    expect(parseTrackerType("IPC- Review Blitz").course).toBe("IPC"); // no space
    expect(parseTrackerType("I10CM - Review Blitz").course).toBe("I10CM");
    expect(parseTrackerType("PBB -  Review Blitz").course).toBe("PBB"); // double space
  });
});

describe("parseTrackerType — bundles (the padlock/gating case)", () => {
  it("flags a bundle and derives its course + category", () => {
    expect(parseTrackerType("PBC PE Bundle (Ruby, Sapphire, Topaz)")).toEqual({
      course: "PBC",
      category: "practice_exam",
      isBundle: true,
    });
    expect(parseTrackerType("PBB PE Bundle (Aquamarine, Jade, Tanzanite)")).toEqual(
      { course: "PBB", category: "practice_exam", isBundle: true }
    );
    // Bundle with no gemstone list still resolves to course + category.
    expect(parseTrackerType("ICD10G PE Bundle")).toEqual({
      course: "ICD10G",
      category: "practice_exam",
      isBundle: true,
    });
  });
});

describe("parseTrackerType — course modules and empties", () => {
  it("treats a plain course code as course-only (no PE/blitz category)", () => {
    expect(parseTrackerType("PBC")).toEqual({
      course: "PBC",
      category: null,
      isBundle: false,
    });
    expect(parseTrackerType("MTA").category).toBeNull();
    expect(parseTrackerType("ICD-10-CM").category).toBeNull();
  });

  it("handles null / empty", () => {
    expect(parseTrackerType(null)).toEqual({
      course: null,
      category: null,
      isBundle: false,
    });
    expect(parseTrackerType("   ")).toEqual({
      course: null,
      category: null,
      isBundle: false,
    });
  });
});

describe("deriveCourseKey + courseGroupTitle", () => {
  it("groups all of a course's gemstones under one key", () => {
    const keys = [
      "PBC PE  -  Ruby",
      "PBC PE  -  Sapphire",
      "PBC PE  - Topaz",
      "Trial PBC PE",
    ].map(deriveCourseKey);
    expect(new Set(keys)).toEqual(new Set(["PBC"]));
  });

  it("titles per-course tiles for each category", () => {
    expect(courseGroupTitle("PBC", "practice_exam")).toBe("PBC Practice Exams");
    expect(courseGroupTitle("FBC", "blitz")).toBe("FBC Review Blitz");
  });
});

describe("courseBadgeLabel (CCO-T088 catalog redesign — Explore grid card badge)", () => {
  it("joins all three counts with the middle dot, singular/plural correct", () => {
    expect(courseBadgeLabel({ courseModules: 17, blitz: 9, practiceExams: 4 })).toBe(
      "17 chapters · 9 blitz · 4 practice"
    );
    expect(courseBadgeLabel({ courseModules: 1, blitz: 1, practiceExams: 1 })).toBe(
      "1 chapter · 1 blitz · 1 practice"
    );
  });

  it("omits any zero count instead of showing '0 blitz'", () => {
    expect(courseBadgeLabel({ courseModules: 0, blitz: 9, practiceExams: 4 })).toBe(
      "9 blitz · 4 practice"
    );
    expect(courseBadgeLabel({ courseModules: 17, blitz: 0, practiceExams: 0 })).toBe(
      "17 chapters"
    );
  });

  it("returns an empty string when every count is zero", () => {
    expect(courseBadgeLabel({ courseModules: 0, blitz: 0, practiceExams: 0 })).toBe("");
  });
});
