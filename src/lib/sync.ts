/**
 * Podio → Neon sync utilities.
 * Stale-while-revalidate: serve from Neon, refresh from Podio in background if stale.
 */

import { db } from "./db";
import { tests, domains, questions } from "./schema";
import type { Test, Domain, Question } from "./schema";
import {
  filterItems,
  getTextValue,
  getCategoryValue,
  getCategoryValues,
  getNumberValue,
  getAppReferenceIds,
  PODIO_APPS,
  TEST_FIELDS,
  DOMAIN_FIELDS,
  QUESTION_FIELDS,
  ACTIVE_TEST_STATUSES,
  type PodioItem,
} from "./podio";
import { eq, inArray } from "drizzle-orm";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
    syncTestsFromPodio().catch((err) =>
      console.error("Background test sync failed:", err)
    );
  }

  if (cached.length === 0) {
    await syncTestsFromPodio();
    return db.select().from(tests);
  }

  return cached;
}

/** Returns tests with "Active - In Portal" status — controlled from Podio. */
export async function getActiveTests(): Promise<Test[]> {
  const all = await getTests();
  return all.filter((t) => t.status === "Active - In Portal");
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
    syncDomainsFromPodio().catch((err) =>
      console.error("Background domain sync failed:", err)
    );
  }

  if (cached.length === 0) {
    await syncDomainsFromPodio();
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

export async function getQuestionsForTest(
  testPodioId: number
): Promise<Question[]> {
  // Check local cache first
  const cached = await db
    .select()
    .from(questions)
    .where(
      inArray(
        questions.podioItemId,
        db
          .select({ id: questions.podioItemId })
          .from(questions)
          .where(eq(questions.payload as never, testPodioId as never))
      )
    );

  // For now, always fetch from Podio (questions are test-specific and the
  // relationship is stored on the question side via the Tests field)
  return syncQuestionsForTest(testPodioId);
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

function mapPodioQuestion(
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
    payload: item.fields as unknown as Record<string, unknown>,
  };
}
