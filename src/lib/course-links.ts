/**
 * Upsell destinations for LOCKED catalog sections (CCO-T061).
 *
 * When a student sees a course they are not enrolled in, the locked
 * "Enrol to unlock" tile must deep-link to that course's individual long-form
 * sales page on cco.us — NOT the bare homepage. The homepage was the old
 * placeholder (`COURSE_ENROL_URL = "https://www.cco.us"`), and it dead-ended
 * users: Laureen reported on the 2026-06-11 CCO Momentum call that clicking a
 * padlocked exam "took me to the cco.us main page" when it should land on the
 * course's long sales page (Fathom 705685559 [1:05:33], [1:09:03]).
 *
 * Keyed by the Podio "Progress Tracker Type" code (Tests.studentTrackerType),
 * which is also the catalog folder title. Mapping verified 2026-06-18 against
 * the live cco.us pages (H1/title/body copy + CCO's own help-desk cost
 * articles, e.g. "All Costs for IPC (CIC)", "All Costs for PBB (CPB)").
 *
 * Maintenance: when Mary adds a new Student-tier course, add its sales-page URL
 * here. Any unmapped code (or a multi-course / mistagged folder like the
 * Review-Blitz bundle or a stray "CEU" tag) safely falls back to the cco.us
 * course catalog — still on-product, never the homepage.
 */

/** CCO Club subscription page — the live, correct link for Club-tier locks. */
export const CLUB_URL = "https://cco.us/club#price";

/**
 * Fallback for any locked course without a dedicated per-course page: CCO's
 * authoritative "Course, Blitz & Practice Exam Catalog" (H1 "CCO Course, Blitz
 * & Practice Exam Catalog"). It lists every Core Course, Ancillary course,
 * Review Blitz and Practice Exam keyed by the same product codes the portal
 * uses (PBC/FBC/IPC/RAC/PBB/MTA/PATHO/PHARM/ICD-10-CM/ICD-10-PCS), so it is the
 * correct home for the multi-product "Blitz / Practice Exam" folder and the
 * stray "CEU" mistag. (This page independently confirms every per-course URL
 * in COURSE_SALES_URLS below.)
 */
export const COURSE_CATALOG_URL =
  "https://www.cco.us/course-blitz-practice-exam-catalog/";

/**
 * Progress-Tracker-Type code → that course's individual long-form sales page.
 * Only codes with a clean single-course page belong here; everything else
 * falls back to COURSE_CATALOG_URL via courseEnrolUrl().
 */
export const COURSE_SALES_URLS: Record<string, string> = {
  PBC: "https://www.cco.us/medical-coding-course-online/", // Physician Based Coding (CPC prep)
  FBC: "https://www.cco.us/certified-outpatient-coder-coc-course-exam-preparation/", // Facility/Outpatient (COC)
  IPC: "https://www.cco.us/certified-inpatient-coder-cic-course/", // Inpatient Coding (CIC)
  RAC: "https://www.cco.us/certified-risk-adjustment-coder-crc-course-exam-preparation/", // Risk Adjustment (CRC)
  PBB: "https://www.cco.us/certified-professional-biller-cpb-medical-billing-course/", // Physician Based Billing (CPB)
  "ICD-10-CM": "https://www.cco.us/icd-10-cm-diagnostic-coding-course/", // ICD-10-CM diagnosis coding
  "ICD-10-PCS": "https://www.cco.us/icd-10-pcs-procedural-coding-course/", // ICD-10-PCS procedure coding
  MTA: "https://www.cco.us/medical-terminology-anatomy-medical-coders-course/", // Medical Terminology & Anatomy
  PATHO: "https://www.cco.us/pathophysiology-course/", // Pathophysiology
  PHARM: "https://www.cco.us/pharmacology-course/", // Pharmacology
};

// Pre-normalised lookup so matching is case/whitespace-insensitive on the code
// (e.g. " pbc " or "Pbc" still resolves), mirroring the tracker-type matching
// in circle-access.ts.
const NORMALISED: Record<string, string> = Object.fromEntries(
  Object.entries(COURSE_SALES_URLS).map(([k, v]) => [k.trim().toUpperCase(), v])
);

/**
 * Resolve a locked course's "Enrol to unlock" URL from its tracker-type code.
 * Returns the per-course sales page when mapped; otherwise the cco.us course
 * catalog (never the homepage).
 */
export function courseEnrolUrl(trackerCode: string | null | undefined): string {
  if (!trackerCode) return COURSE_CATALOG_URL;
  return NORMALISED[trackerCode.trim().toUpperCase()] ?? COURSE_CATALOG_URL;
}
