/**
 * Podio → Neon sync utilities.
 * Stale-while-revalidate: serve from Neon, refresh from Podio in background if stale.
 */

import { db } from "./db";
import { tests, domains, questions, ceuItems } from "./schema";
import type { Test, Domain, Question, CeuItem } from "./schema";
import {
  filterItems,
  getItem,
  getTextValue,
  getCategoryValue,
  getCategoryValues,
  getNumberValue,
  getDateValue,
  getAppReferenceIds,
  PODIO_APPS,
  TEST_FIELDS,
  CEU_ITEM_FIELDS,
  DOMAIN_FIELDS,
  QUESTION_FIELDS,
  withPodioFallback,
  type PodioItem,
} from "./podio";
import { eq, inArray, arrayContains, notInArray } from "drizzle-orm";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// CCO-T065: single-flight + min-interval guard for the fire-and-forget
// background refreshes. getTests/getDomains fire a full paginated Podio sync on
// EVERY request once the mirror is >5 min stale; under a traffic spike that is
// N concurrent full syncs hammering Podio and amplifying a rate-limit burn (a
// contributor to the 2026-06-24 outage). This collapses concurrent refreshes to
// one in-flight run per serverless instance and refuses to re-fire within
// MIN_BACKGROUND_SYNC_INTERVAL_MS of the last completed one.
const MIN_BACKGROUND_SYNC_INTERVAL_MS = 60 * 1000;

function makeBackgroundRefresher(
  syncFn: () => Promise<void>,
  label: string
): () => void {
  let inFlight: Promise<void> | null = null;
  let lastRunAt = 0;
  return () => {
    if (inFlight) return; // a refresh is already running this instance
    if (Date.now() - lastRunAt < MIN_BACKGROUND_SYNC_INTERVAL_MS) return;
    inFlight = syncFn()
      .catch((err) => console.error(`${label} failed:`, err))
      .finally(() => {
        // Stamp on COMPLETION (success OR failure) so a failing sync also honors
        // the 60s cooldown — otherwise every request during a Podio outage would
        // re-fire it (the breaker stops Podio amplification, but not the log/CPU
        // churn). Caught above, so this finally never sees a rejection.
        lastRunAt = Date.now();
        inFlight = null;
      });
  };
}

// Thunks defer to the hoisted sync function declarations below.
const refreshTestsInBackground = makeBackgroundRefresher(
  () => syncTestsFromPodio(),
  "Background test sync"
);
const refreshDomainsInBackground = makeBackgroundRefresher(
  () => syncDomainsFromPodio(),
  "Background domain sync"
);

// ---------------------------------------------------------------------------
// Tests sync
// ---------------------------------------------------------------------------

export async function getTests(): Promise<Test[]> {
  const cached = await db.select().from(tests);

  const needsRefresh =
    cached.length === 0 ||
    cached.some(
      (t) =>
        !t.syncedAt ||
        Date.now() - new Date(t.syncedAt).getTime() > STALE_THRESHOLD_MS
    );

  if (needsRefresh) {
    refreshTestsInBackground();
  }

  if (cached.length === 0) {
    // CCO-T066: a cold/empty mirror + a Podio 420 must not 500 the catalog.
    // Serve whatever the mirror holds (empty here) rather than throwing.
    await withPodioFallback(
      () => syncTestsFromPodio(),
      (err) =>
        console.error(
          "CCO-T066: cold-start test sync failed; serving empty catalog:",
          err
        )
    );
    return db.select().from(tests);
  }

  return cached;
}

/**
 * Tests visible in the portal catalog. As of the 2026-05-28 meeting (CCO-T044)
 * this is driven by the dedicated "Ready for Portal" = Yes flag, NOT by the
 * overloaded Test Status = "Active - In Portal" (keeps dev-status separate from
 * student-facing readiness). Controlled by Mary in Podio.
 */
export async function getActiveTests(): Promise<Test[]> {
  const all = await getTests();
  return all.filter((t) => t.readyForPortal);
}

export async function syncTestsFromPodio(): Promise<void> {
  let offset = 0;
  const limit = 100;
  const allItems: PodioItem[] = [];

  while (true) {
    const result = await filterItems(PODIO_APPS.TESTS, {}, { limit, offset });
    allItems.push(...result.items);
    if (allItems.length >= result.filtered || result.items.length < limit)
      break;
    offset += limit;
  }

  for (const item of allItems) {
    const record = mapPodioTest(item);
    if (!record) continue;

    await db
      .insert(tests)
      .values(record)
      .onConflictDoUpdate({
        target: tests.podioItemId,
        set: { ...record, syncedAt: new Date() },
      });
  }

  await pruneMissing(tests, allItems);
}

/**
 * CCO-T063 reconcile-prune: drop mirror rows whose Podio item is gone, so the
 * full sync (cron safety-net + background refresh) is a true delete safety-net.
 * The per-item webhook deletes in real time, but a DROPPED item.delete (transient
 * error / breaker-open / missed delivery) would otherwise leave a deleted Test
 * live in the catalog forever, because upsert never prunes.
 *
 * GUARDED: prunes only when we actually fetched a non-empty set. A partial/failed
 * pagination throws before reaching here, and an anomalous empty Podio response
 * is ignored — neither can wipe the live mirror.
 */
async function pruneMissing(
  table: typeof tests | typeof domains,
  fetchedItems: PodioItem[]
): Promise<void> {
  if (fetchedItems.length === 0) return;
  const seenIds = fetchedItems.map((i) => i.item_id);
  await db.delete(table).where(notInArray(table.podioItemId, seenIds));
}

function mapPodioTest(item: PodioItem): Omit<Test, "syncedAt"> | null {
  const name = getTextValue(item, TEST_FIELDS.TEST_NAME);
  if (!name) return null;

  // Use TYPE field (137578152) which is more reliably populated than TEST_TYPE (125981849)
  // Falls back to TEST_TYPE if TYPE is empty
  const typeVal =
    getCategoryValue(item, TEST_FIELDS.TYPE) ||
    getCategoryValue(item, TEST_FIELDS.TEST_TYPE) ||
    null;

  // CCO-T006 + CCO-T033: read access_tier from the Podio category field.
  // T033 extends the options to Free / Club / Student (legacy "Member" ===
  // Club). Pass a recognised tag through verbatim; fall back to "Club" when
  // untagged or unknown — fail-closed (never Free). circle-access
  // .normalizeAccessTier collapses "Member"/unknown → Club at decision time.
  // (The earlier T006 code coerced everything-but-Free to "Member", which
  // would have silently flattened a Podio "Club"/"Student" tag.)
  const accessTierRaw = getCategoryValue(item, TEST_FIELDS.ACCESS_TIER);
  const accessTier =
    accessTierRaw === "Free" ||
    accessTierRaw === "Club" ||
    accessTierRaw === "Club Member" ||
    accessTierRaw === "Student" ||
    accessTierRaw === "Member"
      ? accessTierRaw
      : "Club";

  // CCO-T033: per-test progress-tracker type for Student-tier gating.
  const studentTrackerType =
    getCategoryValue(item, TEST_FIELDS.STUDENT_TRACKER_TYPE) || null;

  // CCO-T044: portal-visibility flag — the catalog source of truth (replaces
  // the Test Status = "Active - In Portal" filter). getActiveTests reads this.
  const readyForPortal =
    getCategoryValue(item, TEST_FIELDS.READY_FOR_PORTAL) === "Yes";

  return {
    podioItemId: item.item_id,
    testName: name,
    testType: typeVal,
    description: getTextValue(item, TEST_FIELDS.TEST_DESCRIPTION) || null,
    domainIds: getAppReferenceIds(item, TEST_FIELDS.DOMAINS),
    questionCount: getNumberValue(item, TEST_FIELDS.NUMBER_OF_QUESTIONS),
    timeLimitMinutes: getNumberValue(item, TEST_FIELDS.TIME_LIMIT),
    passingScore: getNumberValue(item, TEST_FIELDS.PASSING_SCORE),
    status: getCategoryValue(item, TEST_FIELDS.TEST_STATUS) || null,
    accessTier,
    studentTrackerType,
    readyForPortal,
    ceuItemIds: getAppReferenceIds(item, TEST_FIELDS.CEU_ITEMS),
    payload: item.fields as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Domains sync
// ---------------------------------------------------------------------------

export async function getDomains(): Promise<Domain[]> {
  const cached = await db.select().from(domains);

  const needsRefresh =
    cached.length === 0 ||
    cached.some(
      (d) =>
        !d.syncedAt ||
        Date.now() - new Date(d.syncedAt).getTime() > STALE_THRESHOLD_MS
    );

  if (needsRefresh) {
    refreshDomainsInBackground();
  }

  if (cached.length === 0) {
    // CCO-T066: cold mirror + Podio 420 → serve the (empty) mirror, not a 500.
    await withPodioFallback(
      () => syncDomainsFromPodio(),
      (err) =>
        console.error(
          "CCO-T066: cold-start domain sync failed; serving empty domains:",
          err
        )
    );
    return db.select().from(domains);
  }

  return cached;
}

export async function syncDomainsFromPodio(): Promise<void> {
  let offset = 0;
  const limit = 100;
  const allItems: PodioItem[] = [];

  while (true) {
    const result = await filterItems(
      PODIO_APPS.DOMAINS,
      {},
      { limit, offset }
    );
    allItems.push(...result.items);
    if (allItems.length >= result.filtered || result.items.length < limit)
      break;
    offset += limit;
  }

  for (const item of allItems) {
    const record = mapPodioDomain(item);
    if (!record) continue;

    await db
      .insert(domains)
      .values(record)
      .onConflictDoUpdate({
        target: domains.podioItemId,
        set: { ...record, syncedAt: new Date() },
      });
  }

  await pruneMissing(domains, allItems);
}

function mapPodioDomain(item: PodioItem): Omit<Domain, "syncedAt"> | null {
  const title = getTextValue(item, DOMAIN_FIELDS.TITLE);
  if (!title) return null;

  return {
    podioItemId: item.item_id,
    title,
    credential: getCategoryValues(item, DOMAIN_FIELDS.CREDENTIAL),
    status: getCategoryValue(item, DOMAIN_FIELDS.STATUS) || null,
    cpcQuestionCount: getNumberValue(item, DOMAIN_FIELDS.CPC_QUESTION_COUNT),
    payload: item.fields as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// CCO-T063: per-item event-driven sync.
//
// The Podio→portal webhook receiver (POST /api/webhooks/podio) calls these to
// propagate a SINGLE changed item in seconds, instead of relying on the
// fire-and-forget background refresh (which Vercel suspends on response — the
// root cause of Mary's "I changed it in Podio but the portal doesn't show it"
// bug). These reuse the SAME mappers as the full sync above — field mapping is
// never re-implemented, so the two paths can never diverge. A dropped event of
// ANY kind (create/update AND delete) self-heals on the next full sync: upserts
// re-converge changed rows and pruneMissing reconciles deletes.
// ---------------------------------------------------------------------------

/**
 * Fetch ONE Podio item, returning null if it 404s (deleted in Podio — e.g. a
 * late item.update racing an item.delete). Other errors (incl. rate-limit)
 * propagate so the route can log + drop them.
 */
async function getItemOrNull(itemId: number): Promise<PodioItem | null> {
  try {
    return await getItem(itemId);
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/**
 * Upsert ONE Test from Podio into the Neon mirror. Returns false when the item
 * is gone (404) or doesn't map to a record (e.g. no name) — the caller treats
 * either as a no-op, not an error. Mirrors the syncTestsFromPodio loop body.
 */
export async function syncOneTest(itemId: number): Promise<boolean> {
  const item = await getItemOrNull(itemId);
  if (!item) return false;
  const record = mapPodioTest(item);
  if (!record) return false;

  await db
    .insert(tests)
    .values(record)
    .onConflictDoUpdate({
      target: tests.podioItemId,
      set: { ...record, syncedAt: new Date() },
    });
  return true;
}

/**
 * Remove ONE Test from the Neon mirror (Podio item.delete). Idempotent — a
 * missing row is a no-op. Driven by the webhook's `item.delete` branch, where
 * the Podio item is already gone so getItem can't be used.
 */
export async function deleteTest(itemId: number): Promise<void> {
  await db.delete(tests).where(eq(tests.podioItemId, itemId));
}

/** Upsert ONE Domain from Podio into the Neon mirror. See syncOneTest. */
export async function syncOneDomain(itemId: number): Promise<boolean> {
  const item = await getItemOrNull(itemId);
  if (!item) return false;
  const record = mapPodioDomain(item);
  if (!record) return false;

  await db
    .insert(domains)
    .values(record)
    .onConflictDoUpdate({
      target: domains.podioItemId,
      set: { ...record, syncedAt: new Date() },
    });
  return true;
}

/** Remove ONE Domain from the Neon mirror (Podio item.delete). See deleteTest. */
export async function deleteDomain(itemId: number): Promise<void> {
  await db.delete(domains).where(eq(domains.podioItemId, itemId));
}

// ---------------------------------------------------------------------------
// Resolve domain names for a list of domain IDs.
// Triggers domain sync if the domains table is empty.
// ---------------------------------------------------------------------------

export async function getDomainNames(
  domainIds: number[]
): Promise<Map<number, string>> {
  if (!domainIds.length) return new Map();

  // Ensure domains are synced
  await getDomains();

  const rows = await db
    .select({ podioItemId: domains.podioItemId, title: domains.title })
    .from(domains)
    .where(inArray(domains.podioItemId, domainIds));

  return new Map(rows.map((r) => [r.podioItemId, r.title]));
}

// ---------------------------------------------------------------------------
// Questions sync — fetches questions linked to a specific test
// ---------------------------------------------------------------------------

/**
 * CCO-T065: read the last-synced questions for a test straight from the Neon
 * mirror — NO Podio call. This is the exam-start fallback for when a live Podio
 * sync fails (e.g. an HTTP 420 rate-limit, the 2026-06-24 outage): every other
 * student-facing route already degrades to the mirror, and now exam-start can
 * too. Matches on the test linkage that mapPodioQuestion persists
 * (questions.testPodioIds), which is GIN-indexed for the `@>` containment.
 *
 * Rows come back in a stable order (podioItemId) so a fallback attempt serves a
 * deterministic question set. Replaces the old getQuestionsForTest, which
 * computed an unused cache query and then always fell through to the live sync
 * (dead code — it was never called anywhere).
 *
 * Staleness caveat: syncQuestionsForTest is upsert-only (never prunes), so if a
 * question is UNLINKED from this test in Podio, its mirror row keeps the stale
 * testPodioId until it is re-synced via another test. During a Podio outage the
 * fallback could therefore serve a since-unlinked question. Bounded and rare
 * (requires an unlink AND a concurrent outage; the question is still valid) —
 * the reconcile-on-sync prune is a deferred CCO-T065 follow-up.
 */
export async function getMirroredQuestionsForTest(
  testPodioId: number
): Promise<Question[]> {
  return db
    .select()
    .from(questions)
    .where(arrayContains(questions.testPodioIds, [testPodioId]))
    .orderBy(questions.podioItemId);
}

export async function syncQuestionsForTest(
  testPodioId: number
): Promise<Question[]> {
  let offset = 0;
  const limit = 100;
  const allItems: PodioItem[] = [];

  // Filter QB Multi Choice by the Tests field (app ref)
  while (true) {
    const result = await filterItems(
      PODIO_APPS.QB_MULTI_CHOICE,
      { [QUESTION_FIELDS.TESTS]: [testPodioId] },
      { limit, offset }
    );
    allItems.push(...result.items);
    if (allItems.length >= result.filtered || result.items.length < limit)
      break;
    offset += limit;
  }

  const records: Question[] = [];

  for (const item of allItems) {
    const record = mapPodioQuestion(item);
    if (!record) continue;

    await db
      .insert(questions)
      .values({ ...record, syncedAt: new Date() })
      .onConflictDoUpdate({
        target: questions.podioItemId,
        set: { ...record, syncedAt: new Date() },
      });

    records.push({ ...record, syncedAt: new Date() });
  }

  return records;
}

// Exported for unit testing (the test linkage + correct-answer mapping are the
// load-bearing fields the exam-start fallback depends on). CCO-T065.
export function mapPodioQuestion(
  item: PodioItem
): Omit<Question, "syncedAt"> | null {
  const questionText = getTextValue(item, QUESTION_FIELDS.QUESTION_TEXT);
  if (!questionText) return null;

  const optA = getTextValue(item, QUESTION_FIELDS.OPTION_A);
  const optB = getTextValue(item, QUESTION_FIELDS.OPTION_B);
  const optC = getTextValue(item, QUESTION_FIELDS.OPTION_C);
  const optD = getTextValue(item, QUESTION_FIELDS.OPTION_D);
  const correctKey = getCategoryValue(item, QUESTION_FIELDS.CORRECT_ANSWER);
  const rationale = getTextValue(item, QUESTION_FIELDS.RATIONALE);
  const disposition = getCategoryValue(item, QUESTION_FIELDS.DISPOSITION);
  const status = getCategoryValue(item, QUESTION_FIELDS.STATUS);

  const options = [
    { key: "A", text: optA },
    { key: "B", text: optB },
    { key: "C", text: optC },
    { key: "D", text: optD },
  ].filter((o) => o.text); // only include non-empty options

  if (!options.length || !correctKey) return null;

  return {
    podioItemId: item.item_id,
    domainId: null, // domains are tracked at question level via separate field
    questionText,
    options: options as unknown as Record<string, unknown>,
    correctKey,
    rationale: rationale || null,
    difficulty: null, // not reliably populated
    disposition: disposition || null,
    status: status || null,
    // CCO-T065: persist the test linkage so the questions mirror is queryable
    // by test (getMirroredQuestionsForTest). Without this the exam-start Neon
    // fallback has nothing to read on a Podio outage.
    testPodioIds: getAppReferenceIds(item, QUESTION_FIELDS.TESTS),
    payload: item.fields as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// CEU Items sync — fetches CEU items linked to a test
// ---------------------------------------------------------------------------

export async function getCeuItemsForTest(
  testPodioId: number
): Promise<CeuItem[]> {
  const [test] = await db
    .select({ ceuItemIds: tests.ceuItemIds })
    .from(tests)
    .where(eq(tests.podioItemId, testPodioId))
    .limit(1);

  const ids = test?.ceuItemIds ?? [];
  if (!ids.length) return getCeuItemsForTestByReverseLink(testPodioId);

  // Check cache
  const cached = await db
    .select()
    .from(ceuItems)
    .where(inArray(ceuItems.podioItemId, ids));

  const needsRefresh =
    cached.length < ids.length ||
    cached.some(
      (c) =>
        !c.syncedAt ||
        Date.now() - new Date(c.syncedAt).getTime() > STALE_THRESHOLD_MS
    );

  if (needsRefresh) {
    return syncCeuItems(ids);
  }

  return cached;
}

/**
 * CCO-T078: fallback for when a Test's own "CEU Items" reference field
 * (TEST_FIELDS.CEU_ITEMS) is empty. Mary's content-authoring habit links the
 * CEU Item -> Test direction (CEU_ITEM_FIELDS.RELATED_TEST) without always
 * also setting the reverse Test -> CEU Item link — Podio does not keep these
 * two independent reference fields in sync automatically. A live probe found
 * this in 5/22 (~23%) of recently CEU-linked tests, including item 1271 /
 * "CCO Club Q&A #1737" — each one would otherwise silently show no cert
 * download button despite having a real, cert-attached CEU item. This does
 * one live Podio filter call (only reached when the fast forward-link path
 * comes up empty, i.e. right after a CEU exam submission for an
 * under-linked test — infrequent, not a hot path) and syncs anything found
 * into the ceuItems mirror so subsequent reads for the same test are fast.
 */
async function getCeuItemsForTestByReverseLink(
  testPodioId: number
): Promise<CeuItem[]> {
  const result = await filterItems(PODIO_APPS.CEU_ITEMS, {
    [CEU_ITEM_FIELDS.RELATED_TEST]: [testPodioId],
  }).catch((err) => {
    console.error(
      `CCO-T078: reverse-link CEU lookup failed for test ${testPodioId}:`,
      err
    );
    return null;
  });
  if (!result?.items.length) return [];
  return syncCeuItems(result.items.map((it) => it.item_id));
}

async function syncCeuItems(itemIds: number[]): Promise<CeuItem[]> {
  const results: CeuItem[] = [];

  for (const itemId of itemIds) {
    try {
      const item = await getItem(itemId);
      const record = mapPodioCeuItem(item);
      if (!record) continue;

      await db
        .insert(ceuItems)
        .values({ ...record, syncedAt: new Date() })
        .onConflictDoUpdate({
          target: ceuItems.podioItemId,
          set: { ...record, syncedAt: new Date() },
        });

      results.push({ ...record, syncedAt: new Date() });
    } catch (err) {
      console.error(`Failed to sync CEU item ${itemId}:`, err);
    }
  }

  return results;
}

function mapPodioCeuItem(
  item: PodioItem
): Omit<CeuItem, "syncedAt"> | null {
  const title = getTextValue(item, CEU_ITEM_FIELDS.TITLE);
  if (!title) return null;

  const relatedTestIds = getAppReferenceIds(item, CEU_ITEM_FIELDS.RELATED_TEST);

  // Find the AAPC certificate template PDF.
  // Prefer files with "certificate" in the name; otherwise fall back to the first PDF.
  const certificatePdf =
    item.files?.find(
      (f) =>
        f.mimetype === "application/pdf" && /certificate/i.test(f.name)
    ) ??
    item.files?.find((f) => f.mimetype === "application/pdf");

  return {
    podioItemId: item.item_id,
    ceuIndexNumber: getTextValue(item, CEU_ITEM_FIELDS.CEU_INDEX_NUMBER) || null,
    title,
    aapcCeuTypes: getCategoryValues(item, CEU_ITEM_FIELDS.AAPC_CEU_TYPE),
    ceuValue: getNumberValue(item, CEU_ITEM_FIELDS.CEU_VALUE)?.toString() ?? null,
    dateExpires: getDateValue(item, CEU_ITEM_FIELDS.DATE_EXPIRES),
    certificateStatus: getCategoryValue(item, CEU_ITEM_FIELDS.CERTIFICATE_STATUS) || null,
    relatedTestPodioId: relatedTestIds[0] ?? null,
    certificateTemplateFileId: certificatePdf?.file_id ?? null,
    payload: item.fields as unknown as Record<string, unknown>,
  };
}
