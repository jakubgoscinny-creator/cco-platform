import { describe, it, expect, vi, beforeEach } from "vitest";

// CCO-T063: cover the actual write path the webhook drives — the per-item
// helpers (syncOneTest/deleteTest/syncOneDomain/deleteDomain) and the
// reconcile-prune that makes the cron a true delete safety-net. The dispatch
// layer (podio-webhook.test.ts) mocks these helpers, so without this file a
// swapped table, a wrong conflict target, or a missing prune would ship green.

const h = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn(() => Promise.resolve());
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(() => Promise.resolve());
  const del = vi.fn(() => ({ where }));
  const getItem = vi.fn();
  const filterItems = vi.fn();
  return { onConflictDoUpdate, values, insert, where, del, getItem, filterItems };
});

// Mock the Neon db with chainable doubles for insert(...).values(...).onConflictDoUpdate(...)
// and delete(...).where(...).
vi.mock("./db", () => ({ db: { insert: h.insert, delete: h.del } }));

// Keep the real field helpers + constants (mappers depend on them); stub only the
// two Podio network calls the sync path makes.
vi.mock("./podio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./podio")>();
  return { ...actual, getItem: h.getItem, filterItems: h.filterItems };
});

import {
  syncOneTest,
  deleteTest,
  syncOneDomain,
  deleteDomain,
  syncTestsFromPodio,
} from "./sync";
import { tests, domains } from "./schema";
import { TEST_FIELDS, DOMAIN_FIELDS, type PodioItem } from "./podio";

function field(fieldId: number | string, value: unknown) {
  return { field_id: Number(fieldId), external_id: `ext_${fieldId}`, type: "text", label: "x", values: [{ value }] };
}
function testItem(id: number, name = "Sample Test"): PodioItem {
  return { item_id: id, app_item_id: 1, title: name, created_on: "", last_event_on: "", fields: [field(TEST_FIELDS.TEST_NAME, name)] } as unknown as PodioItem;
}
function domainItem(id: number, title = "Sample Domain"): PodioItem {
  return { item_id: id, app_item_id: 1, title, created_on: "", last_event_on: "", fields: [field(DOMAIN_FIELDS.TITLE, title)] } as unknown as PodioItem;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncOneTest (CCO-T063)", () => {
  it("upserts the mapped Test with the correct conflict target + syncedAt stamp", async () => {
    h.getItem.mockResolvedValueOnce(testItem(101));
    const ok = await syncOneTest(101);
    expect(ok).toBe(true);
    expect(h.getItem).toHaveBeenCalledWith(101);
    expect(h.insert).toHaveBeenCalledWith(tests); // not domains — locks the table
    const cfg = (h.onConflictDoUpdate.mock.calls[0] as unknown[])[0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(cfg.target).toBe(tests.podioItemId);
    expect(cfg.set).toHaveProperty("syncedAt");
    expect(cfg.set.testName).toBe("Sample Test");
  });

  it("returns false (skip) when the item 404s — a deleted item, no error", async () => {
    h.getItem.mockRejectedValueOnce(Object.assign(new Error("Podio getItem 999 failed (404)"), { status: 404 }));
    expect(await syncOneTest(999)).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("returns false (skip) when the item doesn't map (no name)", async () => {
    h.getItem.mockResolvedValueOnce({ item_id: 5, app_item_id: 1, title: "", created_on: "", last_event_on: "", fields: [] } as unknown as PodioItem);
    expect(await syncOneTest(5)).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("propagates a non-404 error (e.g. rate-limit) so the route can drop it", async () => {
    h.getItem.mockRejectedValueOnce(new Error("Podio rate limited. Retry after 30s"));
    await expect(syncOneTest(7)).rejects.toThrow("rate limited");
  });
});

describe("deleteTest / deleteDomain (CCO-T063)", () => {
  it("deleteTest issues a delete against the tests table", async () => {
    await deleteTest(202);
    expect(h.del).toHaveBeenCalledWith(tests);
    expect(h.where).toHaveBeenCalledTimes(1);
    expect((h.where.mock.calls[0] as unknown[])[0]).toBeTruthy();
  });

  it("deleteDomain issues a delete against the domains table (not swapped)", async () => {
    await deleteDomain(404);
    expect(h.del).toHaveBeenCalledWith(domains);
  });
});

describe("syncOneDomain (CCO-T063)", () => {
  it("upserts the mapped Domain with the domains conflict target", async () => {
    h.getItem.mockResolvedValueOnce(domainItem(303));
    expect(await syncOneDomain(303)).toBe(true);
    expect(h.insert).toHaveBeenCalledWith(domains);
    const cfg = (h.onConflictDoUpdate.mock.calls[0] as unknown[])[0] as { target: unknown };
    expect(cfg.target).toBe(domains.podioItemId);
  });
});

describe("reconcile-prune in the full sync (CCO-T063)", () => {
  it("prunes mirror rows missing from Podio after a non-empty fetch", async () => {
    h.filterItems.mockResolvedValueOnce({ items: [testItem(1)], total: 1, filtered: 1 });
    await syncTestsFromPodio();
    expect(h.insert).toHaveBeenCalledWith(tests); // upsert ran
    expect(h.del).toHaveBeenCalledWith(tests); // prune ran
    expect((h.where.mock.calls[0] as unknown[])[0]).toBeTruthy(); // notInArray(seenIds)
  });

  it("does NOT prune when Podio returns an empty set (guard against wiping the catalog)", async () => {
    h.filterItems.mockResolvedValueOnce({ items: [], total: 0, filtered: 0 });
    await syncTestsFromPodio();
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.del).not.toHaveBeenCalled();
  });
});
