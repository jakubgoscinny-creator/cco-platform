/**
 * CCO-T034: write a portal exam result into the Podio Test Results app
 * (16234798) in the exact raw shape Zenforo's GlobiFlow "Capture test results"
 * flow (id 2652156) writes, so the app's source-agnostic ACTION state machine
 * fires unchanged:
 *
 *   00 | Trigger Processing   — fires "When a new Test Result is created"
 *   10 | Process and link Contact — matches Contacts by normalized result__email
 *   20 | Process and link Test & PT — matches Tests WHERE Test Name CONTAINS
 *        test__test_name (requires Test Source != null) → sets Exam Lookup + PT Type
 *   40 | Complete Chapter on Progress Tracker — parses the test name for a chapter
 *
 * Consequences locked in by that walk (do NOT "fix" without re-checking the flows):
 *  - The Contact + Exam Lookup refs are resolved by the chain (flow 10 even UNSETS
 *    any Contact ref first), so we deliberately do NOT pre-set them — we write the
 *    canonical Contact email + the exact Test name instead.
 *  - test__test_name is the load-bearing match key; test__test_id is reference-only.
 *  - The ACTION/status category fields are `required`, so a create MUST include them
 *    at their initial states; the chain advances them afterwards.
 */

import { createItem, PODIO_APPS } from "./podio";

// Writable Test Results (16234798) field IDs for a portal-originated row.
export const TEST_RESULT_WRITE_FIELDS = {
  RESULT_EMAIL: 125911826, // email — flow 10 matches the Contact on this
  RESULT_FIRST: 125913230, // text
  RESULT_LAST: 125911818, // text
  RESULT_PERCENTAGE: 125911831, // number
  RESULT_DURATION: 125911832, // duration (value is whole seconds)
  TEST_NAME: 125911836, // text — flow 20 matches the Test by "Name contains" this
  TEST_ID: 125913681, // text — reference only (NOT a match key)
  DATE_TAKEN: 125935780, // date (date-only)
  TEST_SOURCE: 146183536, // category — must be non-null for flow 20 to run
  DEBUGGING_TRACE: 159495002, // text (html) — provenance marker
  // Required category fields — Podio rejects a create without them. Seeded at the
  // same INITIAL states Zenforo's create flow uses; the ACTION chain advances them.
  PROCESSING_STATUS: 202661666, // Active = 1
  ACTION_1_CONTACT: 149821869, // Not Processed = 1
  ACTION_2_TEST_PT: 133039300, // Not Processed = 1
  ACTION_3_COMMENTARY: 171918764, // Not Done = 1
  ACTION_4_COMPLETE_CHAPTER: 184537890, // Not Done = 1
  ACTION_5_NOTIFY_COACH: 215264813, // Not Done = 1
  AUTO_RESULTS_EMAIL_STATUS: 136038030, // Not Sent = 2
} as const;

// Option IDs (from the Test Results app snapshot).
export const TEST_SOURCE_CCO_PORTAL = 5; // matches TEST_SOURCE_OPTIONS.CCO_PORTAL

export interface TestResultWriteInput {
  contactEmail: string;
  contactFullName: string | null;
  testPodioId: number;
  testName: string;
  scorePercent: number;
  durationSeconds: number;
  completedAt: Date;
  attemptId: number;
}

/** Split "First Last Parts" into first token + remainder, matching the Zenforo
 *  create flow's first/last split (cosmetic — used only in Summary/Examinee calcs). */
export function splitName(fullName: string | null): {
  first: string;
  last: string;
} {
  const name = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { first: "", last: "" };
  const idx = name.indexOf(" ");
  if (idx === -1) return { first: name, last: "" };
  return { first: name.slice(0, idx), last: name.slice(idx + 1) };
}

/**
 * Podio's createItem rejects a bare "YYYY-MM-DD" even for a date-only
 * (time-disabled) field — it demands "YYYY-MM-DD HH:MM:SS" and then stores just
 * the date. Use midnight UTC, matching the Zenforo-originated rows (which store
 * `start: "...-... 00:00:00"`).
 */
export function podioDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10) + " 00:00:00";
}

/** Pure mapper — produces the Podio createItem `fields` payload. Unit-tested. */
export function mapTestResultFields(
  input: TestResultWriteInput
): Record<string, unknown> {
  const F = TEST_RESULT_WRITE_FIELDS;
  const { first, last } = splitName(input.contactFullName);

  const fields: Record<string, unknown> = {
    [F.RESULT_EMAIL]: [{ value: input.contactEmail, type: "work" }],
    [F.RESULT_PERCENTAGE]: input.scorePercent,
    [F.RESULT_DURATION]: Math.max(0, Math.round(input.durationSeconds)),
    [F.TEST_NAME]: input.testName,
    [F.DATE_TAKEN]: { start: podioDateOnly(input.completedAt) },
    [F.TEST_SOURCE]: TEST_SOURCE_CCO_PORTAL,
    [F.DEBUGGING_TRACE]: `Created by CCO Portal (attempt ${input.attemptId})`,
    // Initial ACTION/status states (required category fields).
    [F.PROCESSING_STATUS]: 1, // Active
    [F.ACTION_1_CONTACT]: 1, // Not Processed
    [F.ACTION_2_TEST_PT]: 1, // Not Processed
    [F.ACTION_3_COMMENTARY]: 1, // Not Done
    [F.ACTION_4_COMPLETE_CHAPTER]: 1, // Not Done
    [F.ACTION_5_NOTIFY_COACH]: 1, // Not Done
    [F.AUTO_RESULTS_EMAIL_STATUS]: 2, // Not Sent
  };

  // Podio rejects empty strings on text fields — only include names when present.
  if (first) fields[F.RESULT_FIRST] = first;
  if (last) fields[F.RESULT_LAST] = last;

  return fields;
}

/**
 * Create the Test Results row in Podio, returning the new item_id.
 * Bounded retry for transient (5xx/network) failures; does NOT spin on the
 * hourly 420 rate-limit cap — those are left for the backfill sweep.
 */
export async function writeTestResultToPodio(
  input: TestResultWriteInput,
  opts: { maxAttempts?: number } = {}
): Promise<number> {
  const fields = mapTestResultFields(input);
  const maxAttempts = opts.maxAttempts ?? 3;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await createItem(PODIO_APPS.TEST_RESULTS, fields);
      return result.item_id;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // The 420 cap means "wait ~1h" — retrying in-process is pointless and
      // would hold the request. Bail and let the backfill sweep recover it.
      if (/rate limited/i.test(msg)) break;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
