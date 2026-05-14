/**
 * Lazy-fetch and cache legacy test results from Podio Test Results app
 * (16234798) into the Neon `legacy_test_results` mirror.
 *
 * - Source of truth: Podio. Filter by Contact item_id; per-student
 *   result counts are small (Renee: 20).
 * - TTL: 24h. After that, refresh from Podio.
 * - Pass/fail is derived from score >= 70% because the legacy
 *   `result__passed` text field is unreliable.
 */

import { db } from "./db";
import { legacyTestResults, type LegacyTestResult } from "./schema";
import { eq, desc, max } from "drizzle-orm";
import { getLegacyTestResultsByContact } from "./podio";
import { getCeuItemsForTest } from "./sync";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getLegacyResultsForContact(
  contactItemId: number
): Promise<LegacyTestResult[]> {
  // Check freshness of the cache
  const [freshness] = await db
    .select({ latest: max(legacyTestResults.syncedAt) })
    .from(legacyTestResults)
    .where(eq(legacyTestResults.contactItemId, contactItemId));

  const isStale =
    !freshness?.latest ||
    Date.now() - new Date(freshness.latest).getTime() > TTL_MS;

  if (isStale) {
    await refreshLegacyResultsForContact(contactItemId);
  }

  return db
    .select()
    .from(legacyTestResults)
    .where(eq(legacyTestResults.contactItemId, contactItemId))
    .orderBy(desc(legacyTestResults.dateTaken));
}

export async function refreshLegacyResultsForContact(
  contactItemId: number
): Promise<number> {
  const podioResults = await getLegacyTestResultsByContact(contactItemId, {
    limit: 500,
  });

  if (!podioResults.length) return 0;

  // Pre-derive pass/fail and identify CEU+passed rows that need an AAPC
  // certificate template lookup. We only resolve once per unique testItemId
  // to keep this O(distinct tests) rather than O(rows).
  const ceuTestIds = new Set<number>();
  for (const r of podioResults) {
    const passed = r.scorePercent != null ? r.scorePercent >= 70 : null;
    const isCeu = /CEU/i.test(r.type || "");
    if (passed && isCeu && r.testItemId) ceuTestIds.add(r.testItemId);
  }

  const templateByTest = new Map<
    number,
    { fileId: number | null; ceuIndex: string | null }
  >();
  for (const testItemId of ceuTestIds) {
    try {
      const items = await getCeuItemsForTest(testItemId);
      const withTemplate = items.find((c) => c.certificateTemplateFileId);
      templateByTest.set(testItemId, {
        fileId: withTemplate?.certificateTemplateFileId ?? null,
        ceuIndex: withTemplate?.ceuIndexNumber ?? null,
      });
    } catch (err) {
      console.error(
        `Failed to resolve CEU template for test ${testItemId}:`,
        err
      );
      templateByTest.set(testItemId, { fileId: null, ceuIndex: null });
    }
  }

  const rows = podioResults.map((r) => {
    const passed = r.scorePercent != null ? r.scorePercent >= 70 : null;
    const isCeu = /CEU/i.test(r.type || "");
    const tpl =
      passed && isCeu && r.testItemId
        ? templateByTest.get(r.testItemId)
        : undefined;

    return {
      podioItemId: r.podioItemId,
      contactItemId,
      appItemId: r.appItemId,
      dateTaken: r.dateTaken,
      testItemId: r.testItemId,
      testName: r.testName || null,
      scorePercent: r.scorePercent != null ? r.scorePercent.toFixed(2) : null,
      passed,
      source: r.source || null,
      type: r.type || null,
      durationSeconds: r.durationSeconds,
      legacyCertUrl: r.legacyCertUrl || null,
      legacyViewUrl: r.legacyViewUrl || null,
      aapcTemplateFileId: tpl?.fileId ?? null,
      ceuIndexNumber: tpl?.ceuIndex ?? null,
      syncedAt: new Date(),
    };
  });

  // Per-row upsert: Drizzle's batch insert with onConflictDoUpdate uses a
  // single `set` clause for all rows, which would clobber different rows
  // to the same values. Loop is correct here.
  for (const row of rows) {
    await db
      .insert(legacyTestResults)
      .values(row)
      .onConflictDoUpdate({
        target: legacyTestResults.podioItemId,
        set: row,
      });
  }

  return rows.length;
}
