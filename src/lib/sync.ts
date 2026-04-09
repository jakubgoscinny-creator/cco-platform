/**
 * Podio → Neon sync utilities.
 * Stale-while-revalidate: serve from Neon, refresh from Podio in background if stale.
 */

import { db } from "./db";
import { tests, domains, questions } from "./schema";
import type { Test, Domain } from "./schema";
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
    // Fire-and-forget background refresh (don't await in the happy path)
    syncTestsFromPodio().catch((err) =>
      console.error("Background test sync failed:", err)
    );
  }

  // If we have no data at all, we must wait for the sync
  if (cached.length === 0) {
    await syncTestsFromPodio();
    return db.select().from(tests);
  }

  return cached;
}

export async function syncTestsFromPodio(): Promise<void> {
  let offset = 0;
  const limit = 100;
  const allItems: PodioItem[] = [];

  // Paginate through all tests
  while (true) {
    const result = await filterItems(PODIO_APPS.TESTS, {}, { limit, offset });
    allItems.push(...result.items);
    if (allItems.length >= result.filtered || result.items.length < limit) break;
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

  return {
    podioItemId: item.item_id,
    testName: name,
    testType: getCategoryValue(item, TEST_FIELDS.TEST_TYPE) || null,
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
    const result = await filterItems(PODIO_APPS.DOMAINS, {}, { limit, offset });
    allItems.push(...result.items);
    if (allItems.length >= result.filtered || result.items.length < limit) break;
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
// Resolve domain names for a list of domain IDs
// ---------------------------------------------------------------------------

export async function getDomainNames(
  domainIds: number[]
): Promise<Map<number, string>> {
  if (!domainIds.length) return new Map();

  const rows = await db
    .select({ podioItemId: domains.podioItemId, title: domains.title })
    .from(domains)
    .where(inArray(domains.podioItemId, domainIds));

  return new Map(rows.map((r) => [r.podioItemId, r.title]));
}
