/**
 * CCO-T088: Blitz / Practice-Exam categorisation + per-course grouping helpers.
 *
 * Two related jobs, both PRESENTATIONAL-first:
 *
 * 1. `classifyTestCategory` buckets a Test's category field (Podio Tests "Type",
 *    137578152, mirrored to `tests.testType`) into the catalog's top-level
 *    sections. Mary re-tagged every Blitz / Practice Exam test individually on
 *    2026-06-25, so the live values are the clean "Blitz" and "Practice Exam";
 *    the old combined "Blitz/Practice Exam" is kept as a FALLBACK bucket per the
 *    6/25 call ("leave the combo one just in case we break some").
 *
 * 2. `parseTrackerType` reads a progress-tracker-type string (the Tests
 *    "Progress Tracker Type" field, and the same values mirrored onto a
 *    Contact's enrollments) into { course, category, isBundle }. The catalog
 *    uses it to group a course's practice exams into one tile (e.g. the PBC
 *    gemstones Ruby / Sapphire / Topaz under "PBC Practice Exams"), and
 *    circle-access uses it for the bundle-expansion safety net (a
 *    "<course> PE Bundle" enrollment unlocks that course's practice exams).
 *
 * Grouping/labelling here never changes test ACCESS on its own — gating stays in
 * circle-access.ts. The only access-affecting consumer is the explicit,
 * reviewed bundle-expansion path there (CCO-T088).
 */

export type TestCategory = "blitz" | "practice_exam" | "blitz_practice_combo";

/** Section titles for each category bucket (catalog folder headings). */
export const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  practice_exam: "Practice Exams",
  blitz: "Review Blitz Exams",
  blitz_practice_combo: "Blitz & Practice Exams",
};

/**
 * Normalise a raw value for tolerant matching: lower-case, and treat runs of
 * whitespace and slashes as a single space, so "Blitz / Practice Exam" and
 * "Blitz/Practice Exam" both collapse to "blitz practice exam".
 */
function normalise(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, " ")
    .trim();
}

/**
 * Map a Test's `testType` to a Blitz / Practice-Exam catalog bucket, or null
 * when it isn't one (Course Module, CEU Quiz, Domain Pool, etc. — those group
 * by course code as before).
 */
export function classifyTestCategory(
  testType: string | null | undefined
): TestCategory | null {
  if (!testType) return null;
  switch (normalise(testType)) {
    case "blitz":
      return "blitz";
    case "practice exam":
    case "practice exams":
      return "practice_exam";
    case "blitz practice exam":
    case "practice exam blitz":
      return "blitz_practice_combo";
    default:
      return null;
  }
}

export interface ParsedTracker {
  /** Normalised course key, e.g. "PBC", "ICD10G". null if not derivable. */
  course: string | null;
  /** Which catalog category the tracker's tests belong to (blitz / PE). */
  category: Exclude<TestCategory, "blitz_practice_combo"> | null;
  /** True when this is a bundle enrollment, e.g. "PBC PE Bundle (Ruby, …)". */
  isBundle: boolean;
}

/**
 * Parse a progress-tracker-type string into { course, category, isBundle }.
 *
 * Handles the live shapes (note the inconsistent spacing in the source data):
 *   "PBC PE - Ruby" / "PBC PE  -  Ruby"        → PBC   / practice_exam
 *   "Trial PBC PE"                             → PBC   / practice_exam
 *   "PBC PE Bundle (Ruby, Sapphire, Topaz)"    → PBC   / practice_exam / bundle
 *   "ICD10G PE Bundle"                         → ICD10G/ practice_exam / bundle
 *   "FBC - Review Blitz" / "IPC- Review Blitz" → FBC/IPC / blitz
 *   "PBC" (course module)                      → PBC   / null
 *
 * Best-effort: an unrecognised course prefix still yields a stable key (so
 * grouping stays consistent), and different aliases (e.g. "ICD10" vs "ICD10G")
 * intentionally stay distinct rather than being guessed-merged.
 */
export function parseTrackerType(raw: string | null | undefined): ParsedTracker {
  const s = (raw ?? "").trim();
  if (!s) return { course: null, category: null, isBundle: false };
  const lower = s.toLowerCase();

  const isBundle = /\bbundle\b/.test(lower);

  let category: ParsedTracker["category"] = null;
  if (/review\s*blitz/.test(lower)) category = "blitz";
  else if (/\bpe\b/.test(lower) || /practice\s*exam/.test(lower))
    category = "practice_exam";

  // Course = leading token(s) before the category marker, minus a Trial prefix.
  const course = s
    .replace(/^\s*trial\s+/i, "")
    .replace(/\s*[-–—]?\s*review\s*blitz.*$/i, "") // "FBC - Review Blitz" → "FBC"
    .replace(/\s+pe\b.*$/i, "") // "PBC PE - Ruby" / "PBC PE Bundle (…)" → "PBC"
    .replace(/\s*[-–—]?\s*practice\s*exams?.*$/i, "") // "X Practice Exam …" → "X"
    .replace(/[-–—\s]+$/, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  return { course: course || null, category, isBundle };
}

/** Course key from a tracker type (e.g. "PBC PE - Ruby" → "PBC"), or null. */
export function deriveCourseKey(
  trackerType: string | null | undefined
): string | null {
  return parseTrackerType(trackerType).course;
}

/**
 * Human title for a per-course tile within a category, e.g. "PBC Practice
 * Exams" / "FBC Review Blitz".
 */
export function courseGroupTitle(courseKey: string, category: TestCategory): string {
  const suffix =
    category === "blitz"
      ? "Review Blitz"
      : category === "practice_exam"
        ? "Practice Exams"
        : "Blitz & Practice";
  return `${courseKey} ${suffix}`;
}

/**
 * CCO-T088 catalog redesign (2026-07-02): counts of a course's tests by kind,
 * used to build the ONE merged "Explore more courses" grid card for a course
 * the viewer has zero access to (regression fix — a prior version of this
 * catalog scattered a locked course's Course Module / Blitz / Practice Exam
 * content across up to 3 separate full-width accordion tiles instead of one
 * scannable card; see catalog/page.tsx).
 */
export interface CourseExploreCounts {
  courseModules: number;
  blitz: number;
  practiceExams: number;
}

/**
 * Format a course's locked-content counts into a compact badge, e.g.
 * "17 chapters · 9 blitz · 4 practice". Omits zero counts; empty counts
 * yields an empty string (caller should not render a badge in that case).
 */
export function courseBadgeLabel(counts: CourseExploreCounts): string {
  const parts: string[] = [];
  if (counts.courseModules > 0) {
    parts.push(`${counts.courseModules} chapter${counts.courseModules === 1 ? "" : "s"}`);
  }
  if (counts.blitz > 0) {
    parts.push(`${counts.blitz} blitz`);
  }
  if (counts.practiceExams > 0) {
    parts.push(`${counts.practiceExams} practice`);
  }
  return parts.join(" · ");
}
