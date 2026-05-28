import { describe, it, expect } from "vitest";
import {
  mapTestResultFields,
  splitName,
  TEST_RESULT_WRITE_FIELDS as F,
  TEST_SOURCE_CCO_PORTAL,
  type TestResultWriteInput,
} from "./test-results-write";

const base: TestResultWriteInput = {
  contactEmail: "renee@example.com",
  contactFullName: "Renee Busacca",
  testPodioId: 3046527757,
  testName: "July 2025 CCO Club Q&A Webinar",
  scorePercent: 100,
  durationSeconds: 183,
  completedAt: new Date("2026-03-25T14:30:00.000Z"),
  attemptId: 42,
};

describe("splitName", () => {
  it("splits the first token from the remainder", () => {
    expect(splitName("Renee Busacca")).toEqual({
      first: "Renee",
      last: "Busacca",
    });
  });

  it("keeps multi-word last names together", () => {
    expect(splitName("Mary Jane Watson Parker")).toEqual({
      first: "Mary",
      last: "Jane Watson Parker",
    });
  });

  it("handles a single name", () => {
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "" });
  });

  it("handles null / whitespace", () => {
    expect(splitName(null)).toEqual({ first: "", last: "" });
    expect(splitName("   ")).toEqual({ first: "", last: "" });
  });
});

describe("mapTestResultFields", () => {
  it("maps the canonical email as a work-typed email value (flow 10 match key)", () => {
    expect(mapTestResultFields(base)[F.RESULT_EMAIL]).toEqual([
      { value: "renee@example.com", type: "work" },
    ]);
  });

  it("writes Test Source = CCO Portal (option id 5) so flow 20's source!=null gate passes", () => {
    const f = mapTestResultFields(base);
    expect(f[F.TEST_SOURCE]).toBe(TEST_SOURCE_CCO_PORTAL);
    expect(f[F.TEST_SOURCE]).toBe(5);
  });

  it("writes duration in whole seconds (rounded, never negative)", () => {
    expect(
      mapTestResultFields({ ...base, durationSeconds: 183.6 })[F.RESULT_DURATION]
    ).toBe(184);
    expect(
      mapTestResultFields({ ...base, durationSeconds: -5 })[F.RESULT_DURATION]
    ).toBe(0);
  });

  it("writes Date Taken as a UTC date-only start", () => {
    expect(mapTestResultFields(base)[F.DATE_TAKEN]).toEqual({
      start: "2026-03-25",
    });
  });

  it("uses the exact test name (load-bearing match key for flow 20 + flow 40)", () => {
    expect(mapTestResultFields(base)[F.TEST_NAME]).toBe(
      "July 2025 CCO Club Q&A Webinar"
    );
  });

  it("writes the score percent unchanged", () => {
    expect(
      mapTestResultFields({ ...base, scorePercent: 86.67 })[F.RESULT_PERCENTAGE]
    ).toBe(86.67);
  });

  it("seeds the required ACTION/status category fields at their initial states", () => {
    const f = mapTestResultFields(base);
    expect(f[F.PROCESSING_STATUS]).toBe(1); // Active
    expect(f[F.ACTION_1_CONTACT]).toBe(1); // Not Processed
    expect(f[F.ACTION_2_TEST_PT]).toBe(1); // Not Processed
    expect(f[F.ACTION_3_COMMENTARY]).toBe(1); // Not Done
    expect(f[F.ACTION_4_COMPLETE_CHAPTER]).toBe(1); // Not Done
    expect(f[F.ACTION_5_NOTIFY_COACH]).toBe(1); // Not Done
    expect(f[F.AUTO_RESULTS_EMAIL_STATUS]).toBe(2); // Not Sent
  });

  it("splits the contact name into first/last", () => {
    const f = mapTestResultFields(base);
    expect(f[F.RESULT_FIRST]).toBe("Renee");
    expect(f[F.RESULT_LAST]).toBe("Busacca");
  });

  it("omits empty name fields (Podio rejects empty strings)", () => {
    const f = mapTestResultFields({ ...base, contactFullName: null });
    expect(f[F.RESULT_FIRST]).toBeUndefined();
    expect(f[F.RESULT_LAST]).toBeUndefined();
  });
});
