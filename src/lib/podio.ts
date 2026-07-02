/**
 * Podio API client for server-side use only.
 * Uses OAuth2 password/refresh_token flow (user-level auth).
 * Supports accessing multiple apps across workspaces.
 */

import { isEntitledTrackerStatus } from "./circle-access";

const PODIO_API = "https://api.podio.com";

/**
 * Thrown when Podio returns HTTP 420 (rate limit), or while the in-process
 * circuit breaker below is open. Carries the Retry-After window so callers can
 * surface an honest wait time. The message text is kept verbatim ("Podio rate
 * limited. Retry after Ns") because some callers string-match it
 * (e.g. forgotPasswordAction) — do not reword without updating them.
 */
export class PodioRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Podio rate limited. Retry after ${retryAfterSeconds}s`);
    this.name = "PodioRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Type guard: did this error come from a Podio rate-limit (HTTP 420 / open breaker)? */
export function isPodioRateLimit(err: unknown): err is PodioRateLimitError {
  return err instanceof PodioRateLimitError;
}

/**
 * CCO-T066: the portal's resilience primitive. Run a per-request Podio
 * operation; if it throws, run `fallback` instead of letting the error become a
 * hard 500. The fallback receives the error so it can branch (e.g. serve the
 * Neon mirror on any failure, or `isPodioRateLimit(err)` → a friendly retry
 * message). Catches ALL errors — use the cert-route try/catch form instead when
 * only a rate-limit should degrade and genuine errors must still surface.
 */
export async function withPodioFallback<T>(
  op: () => Promise<T>,
  fallback: (err: unknown) => T | Promise<T>
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    return await fallback(err);
  }
}

// CCO-T065 circuit breaker. Once Podio rate-limits us (HTTP 420), every Podio
// call short-circuits until the Retry-After window elapses instead of hammering
// an already-throttled API and deepening the burn — the 2026-06-24 exam outage
// amplified itself exactly this way (see the 2026-05-21 rate-limit postmortem
// in CONTINUITY). Module-scoped, so it trips PER serverless instance: enough to
// flatten a concurrent burst on a warm instance, with the Neon mirror
// fallbacks (catalog/sign-in/gradebook/exam-start) covering reads while it is
// open. A Neon-shared breaker (the rate-limit.ts pattern) is the cross-instance
// next step if per-instance proves insufficient.
let rateLimitedUntil = 0;

/** Clamp a retry-after delta to a sane 1s..1h window. */
function clampRetrySeconds(seconds: number): number {
  return Math.min(3600, Math.max(1, Math.floor(seconds)));
}

/**
 * Parse a Retry-After header. RFC 7231 allows delta-seconds OR an HTTP-date;
 * handle both, defaulting to 60s when absent/unparseable.
 */
function parseRetryAfter(headerValue: string | null): number {
  if (headerValue) {
    const asSeconds = Number(headerValue);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return clampRetrySeconds(asSeconds);
    }
    const asDate = Date.parse(headerValue);
    if (Number.isFinite(asDate)) {
      return clampRetrySeconds((asDate - Date.now()) / 1000);
    }
  }
  return 60;
}

/**
 * Trip the breaker for a rate-limited response's window and throw. Shared by
 * podioFetch (initial + post-401 retry) and getAccessToken so EVERY Podio
 * entry point — including the OAuth token endpoint — backs off uniformly.
 */
function tripBreakerFromResponse(res: Response): never {
  const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
  rateLimitedUntil = Date.now() + retryAfter * 1000;
  throw new PodioRateLimitError(retryAfter);
}

let tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  // Use refresh token to get a new access token
  const refreshToken =
    tokenCache?.refreshToken ?? process.env.PODIO_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("No PODIO_REFRESH_TOKEN available");
  }

  const res = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.PODIO_CLIENT_ID!,
      client_secret: process.env.PODIO_CLIENT_SECRET!,
    }),
  });

  // The OAuth token endpoint shares Podio's rate cap; trip the breaker here too
  // so a throttled token refresh doesn't get re-attempted on every request.
  if (res.status === 420 || res.status === 429) {
    tripBreakerFromResponse(res);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Podio auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

async function podioFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Breaker open? Fail fast without touching Podio (anti-amplification).
  if (Date.now() < rateLimitedUntil) {
    throw new PodioRateLimitError(
      clampRetrySeconds((rateLimitedUntil - Date.now()) / 1000)
    );
  }

  const token = await getAccessToken();
  let res = await fetch(`${PODIO_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    tokenCache = null;
    const newToken = await getAccessToken();
    res = await fetch(`${PODIO_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  // Podio uses HTTP 420 for rate limiting (429 handled too, defensively). Trip
  // the breaker for the Retry-After window and throw a typed error so the whole
  // instance backs off rather than hammering Podio. Runs for BOTH the initial
  // response and the post-401 retry (the retry no longer returns raw).
  if (res.status === 420 || res.status === 429) {
    tripBreakerFromResponse(res);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getItem(itemId: number): Promise<PodioItem> {
  const res = await podioFetch(`/item/${itemId}`);
  if (!res.ok) {
    // Attach the HTTP status so callers can distinguish a 404 (item deleted in
    // Podio) from a genuine failure — e.g. CCO-T063 syncOneTest skips a 404
    // (a late item.update racing an item.delete) instead of erroring.
    const err = new Error(
      `Podio getItem ${itemId} failed (${res.status})`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function downloadFile(fileId: number): Promise<Uint8Array> {
  const res = await podioFetch(`/file/${fileId}/raw`);
  if (!res.ok) {
    throw new Error(`Podio downloadFile ${fileId} failed (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function filterItems(
  appId: number,
  filters: Record<string, unknown> = {},
  options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDesc?: boolean;
  } = {}
): Promise<{ items: PodioItem[]; total: number; filtered: number }> {
  const body: Record<string, unknown> = {
    filters,
    limit: options.limit ?? 100,
    offset: options.offset ?? 0,
  };
  if (options.sortBy) {
    body.sort_by = options.sortBy;
    body.sort_desc = options.sortDesc ?? false;
  }

  const res = await podioFetch(`/item/app/${appId}/filter/`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio filterItems app ${appId} failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

export async function updateItem(
  itemId: number,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await podioFetch(`/item/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio updateItem ${itemId} failed (${res.status}): ${text}`
    );
  }
}

export async function createItem(
  appId: number,
  fields: Record<string, unknown>
): Promise<{ item_id: number }> {
  const res = await podioFetch(`/item/app/${appId}/`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio createItem app ${appId} failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

/**
 * CCO-T063: activate a Podio webhook after the verify handshake.
 *
 * When a hook is (re)created, Podio POSTs `type=hook.verify` + a `code` to the
 * hook URL. The receiver echoes that code back here to flip the hook to active.
 * Endpoint: `POST /hook/{hook_id}/verify/validate` body `{ code }`
 * (https://developers.podio.com/doc/hooks/validate-hook-verificated-215241).
 * Server-side only — goes through podioFetch so it shares the rate-limit breaker.
 */
export async function verifyPodioHook(
  hookId: number,
  code: string
): Promise<void> {
  const res = await podioFetch(`/hook/${hookId}/verify/validate`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Podio verifyPodioHook ${hookId} failed (${res.status}): ${text}`
    );
  }
}

// ---------------------------------------------------------------------------
// Field value helpers
// ---------------------------------------------------------------------------

export function getFieldValue(
  item: PodioItem,
  fieldId: number | string
): unknown {
  const field = item.fields?.find(
    (f) =>
      f.field_id === Number(fieldId) || f.external_id === String(fieldId)
  );
  if (!field || !field.values?.length) return undefined;
  return field.values;
}

export function getTextValue(
  item: PodioItem,
  fieldId: number | string
): string {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return "";
  return vals[0]?.value ?? "";
}

export function getCategoryValue(
  item: PodioItem,
  fieldId: number | string
): string {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return "";
  return vals[0]?.value?.text ?? "";
}

export function getCategoryValues(
  item: PodioItem,
  fieldId: number | string
): string[] {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals)) return [];
  return vals.map((v) => v?.value?.text ?? "").filter(Boolean);
}

/**
 * Read a category field's selected option ID (not the text). Used where
 * the caller needs to compare against a stable option_id constant rather
 * than a string that could be relabelled in Podio.
 */
export function getCategoryOptionId(
  item: PodioItem,
  fieldId: number | string
): number | null {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return null;
  const raw = vals[0]?.value;
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    const id = Number((raw as { id: unknown }).id);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

export function getNumberValue(
  item: PodioItem,
  fieldId: number | string
): number | null {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return null;
  const raw = vals[0]?.value;
  return raw != null ? Number(raw) : null;
}

export function getAppReferenceIds(
  item: PodioItem,
  fieldId: number | string
): number[] {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals)) return [];
  return vals
    .map((v) => v?.value?.item_id)
    .filter((id): id is number => id != null);
}

// ---------------------------------------------------------------------------
// Identity resolution: Profile → Contact
//
// Platform Profiles (PLATFORM_PROFILES) is the credential store. Every
// Profile has a `person` ref to a Contact (CONTACTS). Contacts is the
// canonical identity hub — Test Results, Circle, Xenforo IDs, subscription
// status all join via Contact, never Profile.
// ---------------------------------------------------------------------------

export async function getContactItemIdFromProfile(
  profileItemId: number
): Promise<number | null> {
  const profile = await getItem(profileItemId);
  const refs = getAppReferenceIds(profile, PROFILE_FIELDS.PERSON);
  return refs[0] ?? null;
}

// ---------------------------------------------------------------------------
// Legacy test-results fetch
// ---------------------------------------------------------------------------

export interface LegacyTestResult {
  podioItemId: number;
  appItemId: number;
  dateTaken: Date | null;
  testItemId: number | null;
  testName: string;
  scorePercent: number | null;
  passed: boolean | null;
  source: string;
  type: string;
  legacyCertUrl: string;
  legacyViewUrl: string;
  durationSeconds: number | null;
}

function parsePassed(val: string): boolean | null {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (v === "true" || v === "yes" || v === "1") return true;
  if (v === "false" || v === "no" || v === "0") return false;
  return null;
}

export async function getLegacyTestResultsByContact(
  contactItemId: number,
  options: { limit?: number } = {}
): Promise<LegacyTestResult[]> {
  const result = await filterItems(
    PODIO_APPS.TEST_RESULTS,
    { [TEST_RESULT_FIELDS.CONTACT]: [contactItemId] },
    {
      limit: options.limit ?? 500,
      sortBy: String(TEST_RESULT_FIELDS.DATE_TAKEN),
      sortDesc: true,
    }
  );

  return (result.items || []).map((item) => {
    const examLookup = getFieldValue(item, TEST_RESULT_FIELDS.EXAM_LOOKUP) as
      | { value?: { item_id?: number; title?: string } }[]
      | undefined;
    const testRef = examLookup?.[0]?.value;

    return {
      podioItemId: item.item_id,
      appItemId: item.app_item_id,
      dateTaken: getDateValue(item, TEST_RESULT_FIELDS.DATE_TAKEN),
      testItemId: testRef?.item_id ?? null,
      testName:
        testRef?.title ?? getTextValue(item, TEST_RESULT_FIELDS.TEST_NAME),
      scorePercent: getNumberValue(item, TEST_RESULT_FIELDS.RESULT_PERCENTAGE),
      passed: parsePassed(getTextValue(item, TEST_RESULT_FIELDS.RESULT_PASSED)),
      source: getCategoryValue(item, TEST_RESULT_FIELDS.TEST_SOURCE),
      type: getCategoryValue(item, TEST_RESULT_FIELDS.PROGRESS_TRACKER_TYPE),
      legacyCertUrl: getTextValue(
        item,
        TEST_RESULT_FIELDS.RESULT_CERTIFICATE_URL
      ),
      legacyViewUrl: getTextValue(
        item,
        TEST_RESULT_FIELDS.VIEW_RESULTS_STUDENTS
      ),
      durationSeconds: getNumberValue(item, TEST_RESULT_FIELDS.RESULT_DURATION),
    };
  });
}

// ---------------------------------------------------------------------------
// CCO-T033: resolve a Contact's enrolled progress-tracker types — the
// Student-tier signal. Each Progress Tracker (app 16163523) links a student
// Contact and carries a single tracker type; we collect the distinct set.
//
// - Filters on the STUDENT ref (NOT the coach ref — the app has both).
// - Returns null on Podio failure so callers can PRESERVE the prior mirrored
//   value rather than clobbering it with an empty set (avoids a false lock-out
//   on a transient Podio error / rate-limit).
// - CCO-T056c: counts the Contact's PTs EXCEPT those in a positively-known
//   teardown Overall Status (Dropped/Refunded, Billing Failure, Expired,
//   Course Subscription Canceled — see isEntitledTrackerStatus). Fail-open on
//   every other/unknown status, so an active student is never locked out on
//   ambiguous data. Club content is gated separately by subscription_status,
//   so the exposure here is bounded to course practice exams.
// ---------------------------------------------------------------------------

export async function getEnrolledTrackerTypesForContact(
  contactItemId: number
): Promise<string[] | null> {
  try {
    // CCO-T056c: paginate. With teardown-status filtering, silently truncating
    // a contact's PTs is now a false-lockout vector — if a torn-down PT of a
    // tracker type lands inside the page while the still-active PT of the SAME
    // type lands outside it, the type would be wrongly dropped. So read ALL
    // pages; never truncate silently (defensive MAX_PAGES cap logs if hit).
    const types = new Set<string>();
    const PAGE = 200;
    const MAX_PAGES = 25; // 5000 PTs — far above any real per-student count
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await filterItems(
        PODIO_APPS.PROGRESS_TRACKER,
        { [PROGRESS_TRACKER_FIELDS.STUDENT]: [contactItemId] },
        { limit: PAGE, offset }
      );
      const items = result.items ?? [];
      for (const item of items) {
        // Skip enrollments whose Overall Status is a positively-known teardown
        // (billing failure / expired / refunded / cancelled). Any other/unknown
        // status counts — fail-open. An active PT of the same type re-adds it.
        const statusId = getCategoryOptionId(
          item,
          PROGRESS_TRACKER_FIELDS.OVERALL_STATUS
        );
        if (!isEntitledTrackerStatus(statusId)) continue;
        const t = getCategoryValue(item, PROGRESS_TRACKER_FIELDS.PROGRESS_TRACKER_TYPE);
        if (t) types.add(t);
      }
      offset += items.length;
      if (items.length < PAGE) break; // last page reached
      if (page === MAX_PAGES - 1) {
        console.error(
          `CCO-T056c: contact ${contactItemId} has >${MAX_PAGES * PAGE} progress trackers; tracker-type resolution may be truncated (review pagination cap).`
        );
      }
    }
    return [...types];
  } catch (err) {
    console.error(
      `CCO-T033: failed to resolve progress trackers for contact ${contactItemId}:`,
      err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Known Podio App IDs
// ---------------------------------------------------------------------------

export const PODIO_APPS = {
  TESTS: 16243239,
  QB_MULTI_CHOICE: 16263017,
  DOMAINS: 16336321,
  PRACTICE_EXAM_BUILDER: 30393890,
  PLATFORM_PROFILES: 30640719,
  PROFESSIONAL_CREDENTIALS: 19824388,
  CONTACTS: 14660191,
  CEU_ITEMS: 14639788,
  TEST_RESULTS: 16234798, // legacy results store, 126K+ items, joins to Contacts
  PROGRESS_TRACKER: 16163523, // CCO-T033: per-Contact course enrollment (student + tracker type)
  QUESTION_FEEDBACK: 30767002, // CCO-T068: student question-feedback app (space 4698044, next to QB+Tests)
} as const;

// CCO-T068: field IDs for the dedicated "CCO Question Feedback" Podio app
// (30767002), created 2026-06-25 via scripts/create-question-feedback-app.mjs.
export const QUESTION_FEEDBACK_FIELDS = {
  COMMENT: 277340078,
  ISSUE_TYPE: 277340079, // category — set by option id (see QUESTION_FEEDBACK_OPTIONS)
  DIFFICULTY: 277340080, // category
  STATUS: 277340081, // category
  QUESTION: 277340082, // app ref → QB Multi Choice (16263017)
  TEST: 277340083, // app ref → Tests (16243239)
  QUESTION_ITEM_ID: 277340084, // plain number fallback / searchable
  STUDENT: 277340085, // reporter name (text)
  CONTACT_ID: 277340086, // reporter Podio contact item id (number)
  ATTEMPT_ID: 277340087, // portal attempt id (number)
  SOURCE: 277340088,
} as const;

// CCO-T068: category option ids, captured from the live app. Setting category
// fields by id (not text) is deterministic — a relabel in Podio won't break the
// write. Keys mirror FEEDBACK_ISSUE_TYPES / FEEDBACK_DIFFICULTIES ids.
export const QUESTION_FEEDBACK_OPTIONS = {
  // Keys mirror FEEDBACK_ISSUE_TYPES ids; values are the live Podio option ids
  // (synced via scripts/update-question-feedback-options.mjs 2026-06-25).
  ISSUE_TYPE: {
    praise: 6,
    suggestion: 7,
    answer_key: 1,
    unclear: 3,
    typo: 2,
    outdated: 4,
    other: 5,
  } as Record<string, number>,
  DIFFICULTY: { easy: 1, medium: 2, hard: 3 } as Record<string, number>,
  STATUS_NEW: 1,
} as const;

export const TEST_FIELDS = {
  TEST_NAME: 125981694,
  TEST_TYPE: 125981849,        // Static | Random (rarely populated)
  TEST_DESCRIPTION: 126284053,
  NUMBER_OF_QUESTIONS: 125981850,
  DOMAINS: 126809748,
  QUESTIONS: 126756811,
  TIME_LIMIT: 125981853,
  PASSING_SCORE: 125981851,
  TEST_STATUS: 125981847,
  TYPE: 137578152,             // CEU Quiz | Domain Pool | Course Module | Blitz/Practice Exam | etc.
  TEST_RESULT_PROCESSING: 150300363,
  CEU_ITEMS: 137578199,        // app ref → CEU Items in Hub
  // CCO-T006: per-test access tier. Mary creates a category field on the
  // Tests app (16243239) with external_id "access-tier". T006 options were
  // Free / Member; CCO-T033 extends to Free / Club / Student. Until the field
  // exists / a test is tagged, mapPodioTest falls back to "Club" (fail-closed).
  ACCESS_TIER: "access-tier",
  // CCO-T033: per-test progress-tracker type (single-select category) — the
  // load-bearing field for Student-tier gating, already live on the Tests app
  // (the same field T034's GlobiFlow flow-20 reads). e.g. PBC / IPC / RAC.
  STUDENT_TRACKER_TYPE: "progress-tracker-type-2",
  // CCO-T044: dedicated portal-visibility flag (Yes/No category, field
  // 276781364). The catalog source of truth as of the 2026-05-28 meeting,
  // replacing the overloaded Test Status = "Active - In Portal".
  READY_FOR_PORTAL: "ready-for-portal",
} as const;

export const CEU_ITEM_FIELDS = {
  CEU_INDEX_NUMBER: 112490651,
  AAPC_CEU_TYPE: 132842950,
  CEU_VALUE: 112265218,
  DATE_EXPIRES: 112265217,
  CERTIFICATE_STATUS: 118758647,
  TITLE: 112264098,
  RELATED_TEST: 127191267,
} as const;

export function getDateValue(
  item: PodioItem,
  fieldId: number | string
): Date | null {
  const vals = getFieldValue(item, fieldId);
  if (!Array.isArray(vals) || !vals.length) return null;
  // Podio date fields put `start` / `start_date` / `start_utc` directly on
  // the value object — there is no extra `.value` wrapper like text fields.
  const v = vals[0] as
    | { start?: string; start_utc?: string; start_date?: string }
    | undefined;
  const start = v?.start_utc ?? v?.start ?? v?.start_date;
  return start ? new Date(start) : null;
}

export const DOMAIN_FIELDS = {
  TITLE: 126809667,
  STATUS: 273027679,
  CREDENTIAL: 126809669,
  CPC_QUESTION_COUNT: 273027773,
} as const;

// Key field IDs for QB Multi Choice questions
export const QUESTION_FIELDS = {
  QUESTION_TEXT: 126153571,
  OPTION_A: 126153574,
  OPTION_B: 126153573,
  OPTION_C: 126153575,
  OPTION_D: 126153576,
  CORRECT_ANSWER: 126153579,
  RATIONALE: 126153582,
  TESTS: 137526907,
  STATUS: 126284767,
  DISPOSITION: 273026086,
} as const;

// Podio Platform Profiles has TWO password-related fields:
//   - "password-2" (field_id 275832539) is a CALCULATION field — readable
//     via getTextValue, but Podio rejects writes to it.
//   - "password"   (field_id 275832540, labeled "Password [H]") is the
//     underlying TEXT field where the actual hash lives.
// Read from PASSWORD; write to PASSWORD_STORAGE. Conflating the two
// breaks createItem with `invalid_value ... 275832539` (see docs/).
export const PROFILE_FIELDS = {
  EMAIL: "email-2",
  PASSWORD: "password-2",
  PASSWORD_STORAGE: "password",
  PERSON: 275832534, // app ref → Contacts (canonical identity)
} as const;

export const CONTACT_FIELDS = {
  NAME: 112436965,
  EMAIL: 112436968,
  SUBSCRIPTION_STATUS: 134218375,
  CIRCLE_USER_ID: 272609487,
  XENFORO_USER_ID: 199121592,
  DEFAULT_USERNAME: 199426950,        // calc: e.g. "ReneeB_96011"
  DEFAULT_USERNAME_MASTER: 199426794, // text master that drives the calc above
  PASSWORD_MASTER: 199172888,         // pp-wf-password-master-h, text plaintext (e.g. "RB5593!")
  // Mary's duplicate-management field. The portal reads this in
  // findContactByEmail so password-reset doesn't fire against a flagged
  // duplicate record. External id is the legacy "statusaction" (it was
  // once labelled "Status/Action").
  DUPLICATE_STATUS: 125701761,
} as const;

/**
 * Option IDs for CONTACT_FIELDS.DUPLICATE_STATUS, captured 2026-05-21 by
 * inspecting the Contacts app. ACTIVE is the canonical "this is the real
 * record" tag. SUSPECTED_DUPLICATE and CONFIRMED_DUPLICATE are flagged
 * by Mary's deduplication workflow and MUST NOT be used as a reset
 * target. NOT_CHECKED / CHECK_NOW / NO_EMAIL_ADDRESS_TO_CHECK are
 * non-canonical-but-not-flagged: still eligible as a fallback when no
 * ACTIVE match exists.
 *
 * Option ID 2 was "Merge" — Mary's already retired it (status: deleted).
 */
export const CONTACT_DUPLICATE_STATUS = {
  CONFIRMED_DUPLICATE: 1,
  ACTIVE: 3,
  SUSPECTED_DUPLICATE: 4,
  CHECK_NOW: 5,
  NOT_CHECKED: 6,
  NO_EMAIL_ADDRESS_TO_CHECK: 7,
} as const;

// Test Results app (legacy results store, 126K+ items as of 2026-04-30)
export const TEST_RESULT_FIELDS = {
  DATE_TAKEN: 125935780,
  RESULT_PERCENTAGE: 125911831,
  RESULT_PASSED: 125911820,
  TEST_NAME: 125911836,                 // text fallback
  TEST_SOURCE: 146183536,               // category — see TEST_SOURCE_OPTIONS
  PROGRESS_TRACKER_TYPE: 128205567,     // category — CEU | Blitz | etc.
  RESULT_CERTIFICATE_URL: 125913685,
  RESULT_DURATION: 125911832,
  EXAMINEE: 125913339,                  // calc
  CONTACT: 125914549,                   // app ref → Contacts
  EXAM_LOOKUP: 142217973,               // app ref → Tests
  VIEW_RESULTS_STUDENTS: 150750509,     // calc — Xenforo deep link
} as const;

export const TEST_SOURCE_OPTIONS = {
  CLASSMARKER: 1,
  PROPROFS: 2,
  CM_DEV: 3,
  XENFORO: 4,
  CCO_PORTAL: 5, // added by Mary 2026-04-30
} as const;

// CCO-T033: Progress Tracker app (16163523) — per-Contact course enrollment.
// Field IDs inspected 2026-05-29 (snapshots/progress-tracker-app.json). The
// app has TWO Contacts refs (student + coach) — Student-tier gating MUST
// filter on STUDENT, never COACH.
export const PROGRESS_TRACKER_FIELDS = {
  STUDENT: 125306242,               // app ref → Contacts (the enrolled student)
  PROGRESS_TRACKER_TYPE: 128205285, // category (single) — PBC / IPC / RAC / ...
  OVERALL_STATUS: 149529784,        // category — Enrolled - *, Graduated, Dropped / Refunded, ...
  COACH: 125305432,                 // app ref → Contacts (the coach — NOT the student)
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PodioItem {
  item_id: number;
  app_item_id: number;
  title: string;
  fields: PodioField[];
  files?: PodioFile[];
  created_on: string;
  last_event_on: string;
}

export interface PodioFile {
  file_id: number;
  name: string;
  mimetype: string;
  size?: number;
  link?: string;
  // "podio" = Podio-hosted (e.g. inserted via Supermenu) — files.podio.com
  // requires a Podio login, so these can't be linked to directly from the
  // portal (CCO-T077); anything else (e.g. "google") is a normal public/
  // permissioned external link already rendered as an <a> in the field HTML.
  hosted_by?: string;
}

export interface PodioField {
  field_id: number;
  external_id: string;
  type: string;
  label: string;
  values: PodioFieldValue[];
}

export interface PodioFieldValue {
  value: unknown;
}
