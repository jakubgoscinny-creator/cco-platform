import { describe, it, expect, vi, beforeEach } from "vitest";
import { CEU_ITEM_FIELDS, QUESTION_FIELDS, type PodioItem } from "./podio";

// CCO-T065 unit coverage for the heart of the exam-start fallback: the test
// linkage that mapPodioQuestion persists, and the mirror read that uses it.
// Without this, a wrong field id or a broken predicate would make the fallback
// silently always-empty while the exam.test.ts suite (which stubs the mirror)
// stayed green.

// Mock the Neon-backed db so importing sync.ts doesn't open a connection.
// getMirroredQuestionsForTest chains db.select().from().where().orderBy().
// getCeuItemsForTest chains db.select().from().where().limit() (tests lookup)
// then db.select().from().where() again (ceuItems cache lookup) — both must
// resolve through the same mocked `select`, so each test configures the
// queue of results select() should return in call order.
const h = vi.hoisted(() => {
  const rows = [{ podioItemId: 7 }];
  let selectResults: unknown[] = [];
  const limit = vi.fn(() => Promise.resolve(selectResults.shift() ?? []));
  const orderBy = vi.fn(() => Promise.resolve(rows));
  const where = vi.fn(() => ({
    orderBy,
    limit,
    then: (resolve: (v: unknown) => void) => resolve(selectResults.shift() ?? []),
  }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const onConflictDoUpdate = vi.fn(() => Promise.resolve());
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const updateWhere = vi.fn(() => Promise.resolve());
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  return {
    select,
    from,
    where,
    orderBy,
    limit,
    insert,
    values,
    onConflictDoUpdate,
    update,
    set,
    updateWhere,
    rows,
    setSelectResults: (results: unknown[]) => {
      selectResults = results;
    },
  };
});
vi.mock("./db", () => ({ db: { select: h.select, insert: h.insert, update: h.update } }));

const podioMocks = vi.hoisted(() => ({
  filterItems: vi.fn(),
  getItem: vi.fn(),
}));
vi.mock("./podio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./podio")>();
  return { ...actual, filterItems: podioMocks.filterItems, getItem: podioMocks.getItem };
});

import {
  mapPodioQuestion,
  getMirroredQuestionsForTest,
  getCeuItemsForTest,
  resolveQuestionImages,
  filterQuestionsByGateStatus,
} from "./sync";
import { QUESTION_GATE_STATUS } from "./podio";

// Reset call counts between every test in this file — several describe
// blocks share the hoisted `h` mock, and an uncleared count from one test
// would silently pollute the call-count assertions of the next.
beforeEach(() => {
  h.setSelectResults([]);
  h.select.mockClear();
  h.from.mockClear();
  h.where.mockClear();
  h.orderBy.mockClear();
  h.limit.mockClear();
  h.insert.mockClear();
  h.values.mockClear();
  h.onConflictDoUpdate.mockClear();
  h.update.mockClear();
  h.set.mockClear();
  h.updateWhere.mockClear();
  podioMocks.filterItems.mockReset();
  podioMocks.getItem.mockReset();
});

// external_id is a non-numeric tag (like real Podio data, e.g. "tests"), so the
// numeric-field-id lookup can't accidentally match on external_id.
function field(fieldId: number | string, values: unknown[]) {
  return { field_id: Number(fieldId), external_id: `ext_${fieldId}`, type: "x", label: "x", values };
}

// A valid QB Multi Choice question linked to two tests (555, 777).
const QUESTION_ITEM = {
  item_id: 999,
  app_item_id: 1,
  title: "q",
  created_on: "",
  last_event_on: "",
  fields: [
    field(QUESTION_FIELDS.QUESTION_TEXT, [{ value: "What is the CPT code for X?" }]),
    field(QUESTION_FIELDS.OPTION_A, [{ value: "Option A" }]),
    field(QUESTION_FIELDS.OPTION_B, [{ value: "Option B" }]),
    field(QUESTION_FIELDS.CORRECT_ANSWER, [{ value: { id: 1, text: "A" } }]),
    field(QUESTION_FIELDS.TESTS, [{ value: { item_id: 555 } }, { value: { item_id: 777 } }]),
  ],
} as unknown as PodioItem;

describe("mapPodioQuestion test linkage (CCO-T065)", () => {
  it("maps the QB 'Tests' app-ref (field 137526907) into testPodioIds", () => {
    const rec = mapPodioQuestion(QUESTION_ITEM);
    expect(rec).not.toBeNull();
    expect(rec!.testPodioIds).toEqual([555, 777]);
    expect(rec!.correctKey).toBe("A");
    expect(rec!.questionText).toContain("CPT");
  });

  it("reads field id 137526907 specifically — a wrong Tests field id yields no linkage", () => {
    // If QUESTION_FIELDS.TESTS ever drifts off 137526907, the app-ref lands
    // under a field mapPodioQuestion no longer reads → empty testPodioIds →
    // the mirror fallback can NEVER match this question. Lock the field id.
    const item = {
      ...QUESTION_ITEM,
      fields: QUESTION_ITEM.fields.map((f) =>
        f.field_id === Number(QUESTION_FIELDS.TESTS) ? { ...f, field_id: 999999 } : f
      ),
    } as unknown as PodioItem;
    const rec = mapPodioQuestion(item);
    expect(rec!.testPodioIds).toEqual([]);
  });

  it("CCO-T079: captures the gate-status option id from field 276090193 (by id, not label)", () => {
    const item = {
      ...QUESTION_ITEM,
      fields: [
        ...QUESTION_ITEM.fields,
        field(QUESTION_FIELDS.GATE_STATUS, [{ value: { id: 1, text: "Current" } }]),
      ],
    } as unknown as PodioItem;
    const rec = mapPodioQuestion(item);
    expect(rec!.gateStatusOptionId).toBe(1);
  });

  it("CCO-T079: an ungated question (no gate-status value in Podio) maps to null, not undefined", () => {
    const rec = mapPodioQuestion(QUESTION_ITEM);
    expect(rec!.gateStatusOptionId).toBeNull();
  });
});

describe("filterQuestionsByGateStatus (CCO-T079)", () => {
  const q = (id: number, gateStatusOptionId: number | null) => ({
    podioItemId: id,
    gateStatusOptionId,
  });

  it("leaves an entirely-ungated test untouched — every question serves, exactly as before this feature existed", () => {
    const list = [q(1, null), q(2, null), q(3, null)];
    expect(filterQuestionsByGateStatus(list)).toEqual(list);
  });

  it("once ANY question in the test is gated, keeps ONLY Current — Draft/Under-Review/Archived AND still-ungated siblings all drop", () => {
    const list = [
      q(1, QUESTION_GATE_STATUS.CURRENT),
      q(2, QUESTION_GATE_STATUS.DRAFT),
      q(3, QUESTION_GATE_STATUS.UNDER_REVIEW),
      q(4, QUESTION_GATE_STATUS.ARCHIVED),
      q(5, QUESTION_GATE_STATUS.UPDATED),
      q(6, null), // never touched — still excluded once the test is gated
    ];
    expect(filterQuestionsByGateStatus(list)).toEqual([q(1, QUESTION_GATE_STATUS.CURRENT)]);
  });

  it("a gated test with nothing marked Current correctly returns empty (matches the real MTA shape: 30 Current out of 374 linked)", () => {
    const list = [q(1, QUESTION_GATE_STATUS.DRAFT), q(2, QUESTION_GATE_STATUS.UNDER_REVIEW)];
    expect(filterQuestionsByGateStatus(list)).toEqual([]);
  });

  it("real MTA shape: 30 Current + 344 ungated → only the 30 Current serve", () => {
    const current = Array.from({ length: 30 }, (_, i) => q(i, QUESTION_GATE_STATUS.CURRENT));
    const ungated = Array.from({ length: 344 }, (_, i) => q(1000 + i, null));
    const result = filterQuestionsByGateStatus([...current, ...ungated]);
    expect(result).toHaveLength(30);
    expect(result.every((r) => r.gateStatusOptionId === QUESTION_GATE_STATUS.CURRENT)).toBe(true);
  });
});

// A CEU item (like real item 1271 / app_item_id 1271) that links to a Test
// only via its own RELATED_TEST field — the Test has no reverse link back.
const CEU_ITEM_ONLY_REVERSE_LINKED = {
  item_id: 3323430049,
  app_item_id: 1271,
  title: "ceu",
  created_on: "",
  last_event_on: "",
  fields: [
    field(CEU_ITEM_FIELDS.TITLE, [{ value: "CCO Club Q&A #1737 Jun" }]),
    field(CEU_ITEM_FIELDS.RELATED_TEST, [{ value: { item_id: 3326365902 } }]),
  ],
  files: [
    { file_id: 111, name: "certificate.pdf", mimetype: "application/pdf" },
  ],
} as unknown as PodioItem;

describe("getCeuItemsForTest reverse-link fallback (CCO-T078)", () => {
  it("falls back to a live CEU_ITEM_FIELDS.RELATED_TEST filter when the Test's own ceuItemIds is empty", async () => {
    // tests-table lookup returns a row with no ceuItemIds (the real-world gap:
    // Mary set CEU item 1271's "Related CCO Test" but never set the Test's own
    // "CEU Items" field).
    h.setSelectResults([[{ ceuItemIds: null }]]);
    podioMocks.filterItems.mockResolvedValue({
      items: [{ item_id: 3323430049 }],
      total: 1,
      filtered: 1,
    });
    podioMocks.getItem.mockResolvedValue(CEU_ITEM_ONLY_REVERSE_LINKED);

    const result = await getCeuItemsForTest(3326365902);

    // Queried the CEU Items app filtered by the reverse RELATED_TEST field —
    // this is the load-bearing predicate; a wrong field id silently returns
    // nothing and the cert button stays missing.
    expect(podioMocks.filterItems).toHaveBeenCalledWith(
      expect.any(Number),
      { [CEU_ITEM_FIELDS.RELATED_TEST]: [3326365902] }
    );
    expect(podioMocks.getItem).toHaveBeenCalledWith(3323430049);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("CCO Club Q&A #1737 Jun");
    expect(result[0].certificateTemplateFileId).toBe(111);
    // The resolved item was persisted into the ceuItems mirror.
    expect(h.insert).toHaveBeenCalled();
  });

  it("does not call the reverse-link fallback when the forward link already resolves", async () => {
    h.setSelectResults([[{ ceuItemIds: [42] }], [{ podioItemId: 42, syncedAt: new Date() }]]);

    await getCeuItemsForTest(999);

    expect(podioMocks.filterItems).not.toHaveBeenCalled();
  });
});

describe("resolveQuestionImages (CCO-T077)", () => {
  it("returns the cached value without a Podio call when already resolved (even if empty)", async () => {
    h.setSelectResults([[{ imageFiles: [] }]]);

    const result = await resolveQuestionImages(555);

    expect(result).toEqual([]);
    expect(podioMocks.getItem).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("fetches the full item and extracts only Podio-hosted image files when unresolved (null)", async () => {
    h.setSelectResults([[{ imageFiles: null }]]);
    podioMocks.getItem.mockResolvedValue({
      item_id: 555,
      files: [
        { file_id: 1, name: "embedded.jpg", mimetype: "image/jpeg", hosted_by: "podio" },
        { file_id: 2, name: "drive-link.jpg", mimetype: "image/jpeg", hosted_by: "google" },
        { file_id: 3, name: "spec.pdf", mimetype: "application/pdf", hosted_by: "podio" },
      ],
    });

    const result = await resolveQuestionImages(555);

    expect(podioMocks.getItem).toHaveBeenCalledWith(555);
    // Google-hosted files and non-image mimetypes are excluded — only the
    // Podio-hosted image survives (files.podio.com requires a Podio login,
    // so only these need the proxy route; the Google link already renders
    // fine as a normal <a> inside the question's own HTML).
    expect(result).toEqual([{ fileId: 1, mimetype: "image/jpeg", name: "embedded.jpg" }]);
    expect(h.update).toHaveBeenCalled();
    expect(h.set).toHaveBeenCalledWith({ imageFiles: result });
  });

  it("returns an empty array without throwing when the Podio fetch fails", async () => {
    h.setSelectResults([[{ imageFiles: null }]]);
    podioMocks.getItem.mockRejectedValue(new Error("Podio rate limited. Retry after 60s"));

    const result = await resolveQuestionImages(555);

    expect(result).toEqual([]);
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("getMirroredQuestionsForTest (CCO-T065)", () => {
  it("reads the questions mirror filtered by test + ordered (no Podio call)", async () => {
    const rows = await getMirroredQuestionsForTest(555);
    expect(h.select).toHaveBeenCalledTimes(1);
    expect(h.from).toHaveBeenCalledTimes(1);
    // A filter condition was applied (the arrayContains @> predicate)...
    expect(h.where).toHaveBeenCalledTimes(1);
    expect((h.where.mock.calls[0] as unknown[])[0]).toBeTruthy();
    // ...and the result is ordered for a deterministic question set.
    expect(h.orderBy).toHaveBeenCalledTimes(1);
    expect(rows).toEqual(h.rows);
  });
});
