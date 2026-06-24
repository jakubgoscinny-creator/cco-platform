import { describe, it, expect, vi, beforeEach } from "vitest";

// CCO-T065 regression suite for startExamAction's question-load path. The
// 2026-06-24 outage was an UNCAUGHT throw out of syncQuestionsForTest (Podio
// HTTP 420) turning /exam/start into a hard Vercel 500. These tests lock the
// four outcomes so a refactor can't reintroduce the 500:
//   1. Podio fails + mirror empty   -> friendly retry error (NOT a throw)
//   2. Podio fails + mirror has data -> fall back, proceed to redirect
//   3. Podio succeeds                -> use live data, never touch the mirror
//   4. Podio succeeds but empty test -> original "no questions" message

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  syncQuestionsForTest: vi.fn(),
  getMirroredQuestionsForTest: vi.fn(),
  canAccessTest: vi.fn(() => "allowed"),
  redirect: vi.fn((url: string) => {
    // Next's redirect() throws internally; emulate so we can assert the target.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  selectQueue: [] as unknown[][],
  insertReturning: vi.fn(async () => [{ id: 42 }]),
}));

vi.mock("@/lib/auth", () => ({ getSession: h.getSession }));
vi.mock("@/lib/sync", () => ({
  syncQuestionsForTest: h.syncQuestionsForTest,
  getMirroredQuestionsForTest: h.getMirroredQuestionsForTest,
}));
vi.mock("@/lib/circle-access", () => ({ canAccessTest: h.canAccessTest }));
// Imported by exam.ts but only used on the submit/write-back path; stub so the
// real modules (which open Podio/DB connections at import) never load.
vi.mock("@/lib/podio", () => ({
  createItem: vi.fn(),
  getItem: vi.fn(),
  PODIO_APPS: {},
}));
vi.mock("@/lib/test-results-write", () => ({ writeTestResultToPodio: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));

// Minimal chainable Drizzle mock. select().from().where().limit() drains the
// queue; insert().values() is awaitable AND chains .returning().
vi.mock("@/lib/db", () => {
  const limit = vi.fn(async () => h.selectQueue.shift() ?? []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const values = vi.fn(() => {
    const p = Promise.resolve([{ id: 42 }]) as Promise<unknown> & {
      returning: typeof h.insertReturning;
    };
    p.returning = h.insertReturning;
    return p;
  });
  const insert = vi.fn(() => ({ values }));
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const update = vi.fn(() => ({ set }));
  return { db: { select, insert, update } };
});

import { startExamAction } from "./exam";

const TEST_ROW = { podioItemId: 555, timeLimitMinutes: 60, testName: "Test X" };
const CONTACT_ROW = { subscriptionStatus: "Active Annual", enrolledTrackerTypes: null };
const MIRROR_Q = {
  podioItemId: 1,
  domainId: null,
  questionText: "Q1",
  options: [{ key: "A", text: "a" }],
  correctKey: "A",
  rationale: null,
  difficulty: null,
  disposition: null,
  status: null,
  testPodioIds: [555],
  payload: {},
  syncedAt: new Date(),
};

const HIGH_DEMAND_ERROR =
  "The exam couldn't load due to high demand — please try again in a minute.";

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.selectQueue.length = 0;
  h.getSession.mockResolvedValue({ contactId: 123 });
  h.canAccessTest.mockReturnValue("allowed");
  h.insertReturning.mockResolvedValue([{ id: 42 }]);
  // The fallback path logs via console.error by design; keep test output clean
  // while still asserting the operational breadcrumb fires.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("startExamAction question-load fallback (CCO-T065)", () => {
  it("returns a friendly retry error (not a 500) when Podio fails and the mirror is empty", async () => {
    h.selectQueue.push([TEST_ROW], [CONTACT_ROW]);
    h.syncQuestionsForTest.mockRejectedValue(
      new Error("Podio rate limited. Retry after 60s")
    );
    h.getMirroredQuestionsForTest.mockResolvedValue([]);

    const result = await startExamAction(555);

    expect(result).toEqual({ error: HIGH_DEMAND_ERROR });
    expect(h.getMirroredQuestionsForTest).toHaveBeenCalledWith(555);
    // No phantom attempt created when there are no questions to serve.
    expect(h.insertReturning).not.toHaveBeenCalled();
    // The operational breadcrumb ops rely on during a 420 burn must fire.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("CCO-T065"),
      expect.anything()
    );
  });

  it("does not throw even when BOTH Podio and the Neon mirror fail", async () => {
    h.selectQueue.push([TEST_ROW], [CONTACT_ROW]);
    h.syncQuestionsForTest.mockRejectedValue(new Error("Podio rate limited. Retry after 60s"));
    h.getMirroredQuestionsForTest.mockRejectedValue(new Error("Neon unreachable"));

    const result = await startExamAction(555);

    expect(result).toEqual({ error: HIGH_DEMAND_ERROR });
    expect(h.insertReturning).not.toHaveBeenCalled();
  });

  it("falls back to mirrored questions when Podio sync fails", async () => {
    h.selectQueue.push([TEST_ROW], [CONTACT_ROW]);
    h.syncQuestionsForTest.mockRejectedValue(new Error("Podio rate limited. Retry after 60s"));
    h.getMirroredQuestionsForTest.mockResolvedValue([MIRROR_Q]);

    // Success path ends in redirect(), which our mock throws as NEXT_REDIRECT.
    await expect(startExamAction(555)).rejects.toThrow("NEXT_REDIRECT:/exam/take/42");
    expect(h.redirect).toHaveBeenCalledWith("/exam/take/42");
  });

  it("uses live Podio questions and never touches the mirror on success", async () => {
    h.selectQueue.push([TEST_ROW], [CONTACT_ROW]);
    h.syncQuestionsForTest.mockResolvedValue([MIRROR_Q]);

    await expect(startExamAction(555)).rejects.toThrow("NEXT_REDIRECT:/exam/take/42");
    expect(h.getMirroredQuestionsForTest).not.toHaveBeenCalled();
  });

  it("returns the original 'no questions' message when Podio succeeds but the test is empty", async () => {
    h.selectQueue.push([TEST_ROW], [CONTACT_ROW]);
    h.syncQuestionsForTest.mockResolvedValue([]);

    const result = await startExamAction(555);

    expect(result).toEqual({ error: "No questions available for this test" });
    expect(h.getMirroredQuestionsForTest).not.toHaveBeenCalled();
  });
});
