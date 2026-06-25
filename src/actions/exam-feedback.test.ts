import { describe, it, expect, vi, beforeEach } from "vitest";

// CCO-T068: submitQuestionFeedbackAction — ownership-guarded, resilient
// write-through (Neon durable first, Podio best-effort). These lock:
//   - auth + ownership guard (no Neon write for stranger/anon)
//   - empty-comment rejection
//   - the happy path (Neon insert → Podio createItem → stamp podio_item_id)
//   - Podio failure still returns ok (Neon row kept, never hard-fails student)

const h = vi.hoisted(() => ({
  FIELDS: {
    COMMENT: 277340078,
    ISSUE_TYPE: 277340079,
    DIFFICULTY: 277340080,
    STATUS: 277340081,
    QUESTION: 277340082,
    TEST: 277340083,
    QUESTION_ITEM_ID: 277340084,
    STUDENT: 277340085,
    CONTACT_ID: 277340086,
    ATTEMPT_ID: 277340087,
    SOURCE: 277340088,
  },
  getSession: vi.fn(),
  createItem: vi.fn(),
  selectQueue: [] as unknown[][],
  insertValues: vi.fn(),
  insertReturning: vi.fn(async () => [{ id: 77 }]),
  updateSet: vi.fn(),
}));

const FIELDS = h.FIELDS;

vi.mock("@/lib/auth", () => ({ getSession: h.getSession }));
vi.mock("@/lib/sync", () => ({
  syncQuestionsForTest: vi.fn(),
  getMirroredQuestionsForTest: vi.fn(),
}));
vi.mock("@/lib/circle-access", () => ({ canAccessTest: vi.fn() }));
vi.mock("@/lib/test-results-write", () => ({ writeTestResultToPodio: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/podio", () => ({
  createItem: h.createItem,
  getItem: vi.fn(),
  PODIO_APPS: { QUESTION_FEEDBACK: 30767002 },
  QUESTION_FEEDBACK_FIELDS: h.FIELDS,
  QUESTION_FEEDBACK_OPTIONS: {
    ISSUE_TYPE: {
      praise: 6,
      suggestion: 7,
      answer_key: 1,
      unclear: 3,
      typo: 2,
      outdated: 4,
      other: 5,
    },
    DIFFICULTY: { easy: 1, medium: 2, hard: 3 },
    STATUS_NEW: 1,
  },
}));

vi.mock("@/lib/db", () => {
  const limit = vi.fn(async () => h.selectQueue.shift() ?? []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const values = vi.fn((v: unknown) => {
    h.insertValues(v);
    const p = Promise.resolve([{ id: 77 }]) as Promise<unknown> & {
      returning: typeof h.insertReturning;
    };
    p.returning = h.insertReturning;
    return p;
  });
  const insert = vi.fn(() => ({ values }));
  const set = vi.fn((v: unknown) => {
    h.updateSet(v);
    return { where: vi.fn(async () => undefined) };
  });
  const update = vi.fn(() => ({ set }));
  return { db: { select, insert, update } };
});

import { submitQuestionFeedbackAction } from "./exam";

const OWNER = { contactId: 123, testPodioId: 555 };

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.selectQueue.length = 0;
  h.getSession.mockResolvedValue({ contactId: 123 });
  h.insertReturning.mockResolvedValue([{ id: 77 }]);
  h.createItem.mockResolvedValue({ item_id: 999 });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

const VALID = {
  attemptId: 1,
  questionPodioId: 42,
  comment: "  The answer key looks wrong  ",
  difficulty: "hard",
  issueType: "answer_key",
};

describe("submitQuestionFeedbackAction (CCO-T068)", () => {
  it("rejects unauthenticated callers without writing", async () => {
    h.getSession.mockResolvedValue(null);
    const r = await submitQuestionFeedbackAction(VALID);
    expect(r).toHaveProperty("error");
    expect(h.insertValues).not.toHaveBeenCalled();
    expect(h.createItem).not.toHaveBeenCalled();
  });

  it("rejects a non-owner attempt without writing", async () => {
    h.selectQueue.push([{ contactId: 999, testPodioId: 555 }]); // someone else's attempt
    const r = await submitQuestionFeedbackAction(VALID);
    expect(r).toHaveProperty("error");
    expect(h.insertValues).not.toHaveBeenCalled();
    expect(h.createItem).not.toHaveBeenCalled();
  });

  it("rejects an empty comment", async () => {
    h.selectQueue.push([OWNER]);
    const r = await submitQuestionFeedbackAction({ ...VALID, comment: "   " });
    expect(r).toHaveProperty("error");
    expect(h.insertValues).not.toHaveBeenCalled();
  });

  it("writes Neon + Podio on the happy path and stamps the podio item id", async () => {
    h.selectQueue.push([OWNER], [{ fullName: "Renee Busacca" }]);
    const r = await submitQuestionFeedbackAction(VALID);

    expect(r).toEqual({ ok: true });

    // Neon row: comment trimmed, difficulty + issue stored, contact resolved.
    expect(h.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId: 1,
        questionPodioId: 42,
        comment: "The answer key looks wrong",
        difficultyRating: "hard",
        issueType: "answer_key",
        contactId: 123,
      })
    );

    // Podio item: category fields by OPTION ID, app-ref Question by item id.
    expect(h.createItem).toHaveBeenCalledTimes(1);
    const [appId, fields] = h.createItem.mock.calls[0];
    expect(appId).toBe(30767002);
    expect(fields[FIELDS.COMMENT]).toBe("The answer key looks wrong");
    expect(fields[FIELDS.DIFFICULTY]).toBe(3); // hard → option id 3
    expect(fields[FIELDS.ISSUE_TYPE]).toBe(1); // answer_key → option id 1
    expect(fields[FIELDS.QUESTION]).toEqual([42]);
    expect(fields[FIELDS.TEST]).toEqual([555]);
    expect(fields[FIELDS.STATUS]).toBe(1); // New

    // podio_item_id stamped back onto the Neon row.
    expect(h.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ podioItemId: 999 })
    );
  });

  it("keeps the Neon row and still returns ok when the Podio write fails", async () => {
    h.selectQueue.push([OWNER], [{ fullName: "Renee" }]);
    h.createItem.mockRejectedValue(new Error("Podio rate limited. Retry after 60s"));

    const r = await submitQuestionFeedbackAction(VALID);

    expect(r).toEqual({ ok: true }); // student never sees a hard failure
    expect(h.insertValues).toHaveBeenCalledTimes(1); // Neon row persisted
    expect(h.updateSet).not.toHaveBeenCalled(); // no podio id to stamp
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("CCO-T068"),
      expect.anything()
    );
  });

  it("drops an unknown difficulty/issue-type rather than writing junk", async () => {
    h.selectQueue.push([OWNER], [{ fullName: "Renee" }]);
    await submitQuestionFeedbackAction({
      ...VALID,
      difficulty: "impossible",
      issueType: "hacked",
    });
    expect(h.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ difficultyRating: null, issueType: null })
    );
    const [, fields] = h.createItem.mock.calls[0];
    expect(fields[FIELDS.DIFFICULTY]).toBeUndefined();
    expect(fields[FIELDS.ISSUE_TYPE]).toBeUndefined();
  });
});
