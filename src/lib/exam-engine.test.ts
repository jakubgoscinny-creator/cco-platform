import { describe, it, expect } from "vitest";
import {
  examReducer,
  clampPaneWidth,
  PANE_WIDTH_MIN,
  PANE_WIDTH_MAX,
  PANE_WIDTH_DEFAULT,
  type ExamState,
} from "./exam-engine";

// CCO-T067 / CCO-T074: lock the pure state transitions the in-exam UX bundle
// relies on — highlight persistence (must survive in the reducer regardless of
// the React render timing the regression was about) and the pane-width clamp.

function baseState(overrides: Partial<ExamState> = {}): ExamState {
  return {
    attemptId: 1,
    questions: [],
    currentIndex: 0,
    answers: {},
    timeRemaining: 3600,
    status: "active",
    scratchPad: "",
    highlights: {},
    paneWidth: PANE_WIDTH_DEFAULT,
    ...overrides,
  };
}

describe("clampPaneWidth (CCO-T074)", () => {
  it("keeps a value inside the band", () => {
    expect(clampPaneWidth(58)).toBe(58);
  });
  it("clamps below the minimum", () => {
    expect(clampPaneWidth(10)).toBe(PANE_WIDTH_MIN);
    expect(clampPaneWidth(-999)).toBe(PANE_WIDTH_MIN);
  });
  it("clamps above the maximum", () => {
    expect(clampPaneWidth(95)).toBe(PANE_WIDTH_MAX);
    expect(clampPaneWidth(Infinity)).toBe(PANE_WIDTH_MAX);
  });
  it("rounds to 0.1%", () => {
    expect(clampPaneWidth(58.04)).toBe(58);
    expect(clampPaneWidth(58.06)).toBe(58.1);
  });
});

describe("SET_PANE_WIDTH (CCO-T074)", () => {
  it("clamps the dispatched width", () => {
    expect(examReducer(baseState(), { type: "SET_PANE_WIDTH", width: 200 }).paneWidth).toBe(
      PANE_WIDTH_MAX
    );
    expect(examReducer(baseState(), { type: "SET_PANE_WIDTH", width: 0 }).paneWidth).toBe(
      PANE_WIDTH_MIN
    );
    expect(examReducer(baseState(), { type: "SET_PANE_WIDTH", width: 62.5 }).paneWidth).toBe(
      62.5
    );
  });
});

describe("highlight reducer round-trip (CCO-T067)", () => {
  it("SET_HIGHLIGHT stores per-question HTML immutably", () => {
    const s0 = baseState();
    const s1 = examReducer(s0, {
      type: "SET_HIGHLIGHT",
      questionId: 100,
      html: "<p>hi <mark>there</mark></p>",
    });
    expect(s1.highlights[100]).toBe("<p>hi <mark>there</mark></p>");
    expect(s0.highlights).toEqual({}); // original untouched
    expect(s1.highlights).not.toBe(s0.highlights);
  });

  it("keeps other questions' highlights when setting one", () => {
    const s = examReducer(
      baseState({ highlights: { 1: "<a/>" } }),
      { type: "SET_HIGHLIGHT", questionId: 2, html: "<b/>" }
    );
    expect(s.highlights).toEqual({ 1: "<a/>", 2: "<b/>" });
  });

  it("CLEAR_HIGHLIGHT removes only the target question", () => {
    const s = examReducer(
      baseState({ highlights: { 1: "<a/>", 2: "<b/>" } }),
      { type: "CLEAR_HIGHLIGHT", questionId: 1 }
    );
    expect(s.highlights).toEqual({ 2: "<b/>" });
  });

  it("a TICK never disturbs stored highlights", () => {
    const s0 = baseState({ highlights: { 7: "<mark>x</mark>" } });
    const s1 = examReducer(s0, { type: "TICK" });
    expect(s1.highlights).toBe(s0.highlights); // same reference → no DOM churn
    expect(s1.timeRemaining).toBe(3599);
  });
});
