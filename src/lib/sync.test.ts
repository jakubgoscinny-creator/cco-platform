import { describe, it, expect, vi } from "vitest";
import { QUESTION_FIELDS, type PodioItem } from "./podio";

// CCO-T065 unit coverage for the heart of the exam-start fallback: the test
// linkage that mapPodioQuestion persists, and the mirror read that uses it.
// Without this, a wrong field id or a broken predicate would make the fallback
// silently always-empty while the exam.test.ts suite (which stubs the mirror)
// stayed green.

// Mock the Neon-backed db so importing sync.ts doesn't open a connection.
// getMirroredQuestionsForTest chains db.select().from().where().orderBy().
const h = vi.hoisted(() => {
  const rows = [{ podioItemId: 7 }];
  const orderBy = vi.fn(() => Promise.resolve(rows));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select, from, where, orderBy, rows };
});
vi.mock("./db", () => ({ db: { select: h.select } }));

import { mapPodioQuestion, getMirroredQuestionsForTest } from "./sync";

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
