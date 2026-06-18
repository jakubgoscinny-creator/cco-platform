import { describe, it, expect } from "vitest";
import {
  courseEnrolUrl,
  COURSE_SALES_URLS,
  COURSE_CATALOG_URL,
  CLUB_URL,
} from "./course-links";

// The 12 Student-tier locked course folders that render live in the catalog
// (from the Neon mirror, 2026-06-18). 10 map to a dedicated sales page; the
// multi-blitz folder and the stray "CEU" mistag fall back to the catalog.
const PER_COURSE_CODES = [
  "PBC",
  "FBC",
  "IPC",
  "RAC",
  "PBB",
  "ICD-10-CM",
  "ICD-10-PCS",
  "MTA",
  "PATHO",
  "PHARM",
];
const FALLBACK_CODES = ["Blitz / Practice Exam", "CEU"];

describe("courseEnrolUrl", () => {
  it("maps each known course code to its dedicated cco.us sales page", () => {
    for (const code of PER_COURSE_CODES) {
      expect(courseEnrolUrl(code)).toBe(COURSE_SALES_URLS[code]);
    }
  });

  it("never returns the bare cco.us homepage (the old dead-end placeholder)", () => {
    for (const code of [...PER_COURSE_CODES, ...FALLBACK_CODES, null, "ZZZ"]) {
      const url = courseEnrolUrl(code);
      expect(url).not.toBe("https://www.cco.us");
      expect(url).not.toBe("https://www.cco.us/");
    }
  });

  it("falls back to the course catalog for multi-course / mistagged folders", () => {
    for (const code of FALLBACK_CODES) {
      expect(courseEnrolUrl(code)).toBe(COURSE_CATALOG_URL);
    }
  });

  it("falls back to the catalog for unknown, null, undefined, or empty codes", () => {
    expect(courseEnrolUrl("QPIN")).toBe(COURSE_CATALOG_URL);
    expect(courseEnrolUrl(null)).toBe(COURSE_CATALOG_URL);
    expect(courseEnrolUrl(undefined)).toBe(COURSE_CATALOG_URL);
    expect(courseEnrolUrl("")).toBe(COURSE_CATALOG_URL);
  });

  it("matches the code case- and whitespace-insensitively", () => {
    expect(courseEnrolUrl(" pbc ")).toBe(COURSE_SALES_URLS.PBC);
    expect(courseEnrolUrl("Pbc")).toBe(COURSE_SALES_URLS.PBC);
    expect(courseEnrolUrl("icd-10-cm")).toBe(COURSE_SALES_URLS["ICD-10-CM"]);
  });

  it("every mapped URL is an https cco.us course page (not club, not homepage)", () => {
    for (const url of Object.values(COURSE_SALES_URLS)) {
      expect(url).toMatch(/^https:\/\/www\.cco\.us\/.+\/$/);
      expect(url).not.toBe(CLUB_URL);
    }
  });
});
