// Coverage audit: does every test that was VISIBLE in yesterday's catalog
// (pre-T088, commit 73b2647) still appear SOMEWHERE in today's catalog (live
// production code)? "Visible" = the viewer can see the test exists (locked
// or unlocked) -- not necessarily open/takeable. Strictly SELECT, read-only.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

function classifyTestCategory(testType) {
  if (!testType) return null;
  const n = testType.trim().toLowerCase().replace(/[\s/]+/g, " ").trim();
  if (n === "blitz") return "blitz";
  if (n === "practice exam" || n === "practice exams") return "practice_exam";
  if (n === "blitz practice exam" || n === "practice exam blitz") return "blitz_practice_combo";
  return null;
}
function parseTrackerType(raw) {
  const s = (raw ?? "").trim();
  if (!s) return { course: null, category: null };
  const lower = s.toLowerCase();
  let category = null;
  if (/review\s*blitz/.test(lower)) category = "blitz";
  else if (/\bpe\b/.test(lower) || /practice\s*exam/.test(lower)) category = "practice_exam";
  const course = s.replace(/^\s*trial\s+/i, "").replace(/\s*[-–—]?\s*review\s*blitz.*$/i, "")
    .replace(/\s+pe\b.*$/i, "").replace(/\s*[-–—]?\s*practice\s*exams?.*$/i, "")
    .replace(/[-–—\s]+$/, "").trim().toUpperCase().replace(/\s+/g, " ");
  return { course: course || null, category };
}

const tests = await sql`
  select podio_item_id, test_name, test_type, student_tracker_type, access_tier
  from tests where ready_for_portal = true`;

// --- OLD (pre-T088, commit 73b2647): every distinct tracker-type STRING is
// its own tile. TITLE is visible whether locked or not (CCO-T044: "show
// EVERY section as a folder"). Individual test NAMES inside a locked folder
// are NOT revealed (old code only pushes to `cards` when accessible).
const oldVisibleTitles = new Set();
for (const t of tests) {
  const tier = (t.access_tier ?? "").trim();
  if (tier === "Free" || tier === "Club") { oldVisibleTitles.add(`${tier}-tier`); continue; }
  const code = t.student_tracker_type || "Course";
  oldVisibleTitles.add(code); // the OLD tile title -- always visible
}

// --- NEW (live production, today): course-level accordion/grid title is
// visible for everything; individual test NAMES are only revealed for
// OWNED categories (accordion cards) -- fully-locked categories collapse
// into one course-level Explore card, no per-product name shown.
const newVisibleCourseKeys = new Set();
for (const t of tests) {
  const tier = (t.access_tier ?? "").trim();
  if (tier === "Free" || tier === "Club") { newVisibleCourseKeys.add(`${tier}-tier`); continue; }
  const cat = classifyTestCategory(t.test_type);
  if (cat === "blitz" || cat === "practice_exam") {
    newVisibleCourseKeys.add(parseTrackerType(t.student_tracker_type).course ?? "Other");
  } else {
    newVisibleCourseKeys.add(t.student_tracker_type || "Course");
  }
}

// --- The actual question: for a FULLY NON-ENROLLED visitor, which OLD tile
// TITLES (specific product names, e.g. "PBC PE  -  Ruby") are no longer
// individually nameable anywhere in the new UI -- only folded into an
// aggregate course-level count?
const oldIndividualProductTitles = [...new Set(
  tests
    .filter(t => classifyTestCategory(t.test_type) === "blitz" || classifyTestCategory(t.test_type) === "practice_exam")
    .map(t => t.student_tracker_type)
)];

console.log(`Old design: ${oldIndividualProductTitles.length} distinct named Blitz/PE product tiles would have been individually visible (titled) to a non-enrolled visitor, even locked.`);
console.log(`New design: those collapse into ${new Set(oldIndividualProductTitles.map(t => parseTrackerType(t).course ?? "Other")).size} course-level cards -- individual product names (e.g. which gemstone) are NOT shown on the card, only an aggregate count.\n`);
console.log("Sample of what's no longer individually named on the catalog page for a non-enrolled visitor:");
for (const title of oldIndividualProductTitles.slice(0, 15)) console.log(`  "${title}"`);
console.log(`  ... and ${oldIndividualProductTitles.length - 15} more`);
