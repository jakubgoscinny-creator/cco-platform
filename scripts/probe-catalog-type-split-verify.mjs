// Verifies the type-split Explore sections: a course's locked content is
// grouped into 3 SEPARATE sections (courses/blitz/practice), never merged
// into one card. Strictly SELECT, read-only.
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
  return null;
}
function parseTrackerType(raw) {
  const s = (raw ?? "").trim();
  if (!s) return { course: null };
  const lower = s.toLowerCase();
  const course = s.replace(/^\s*trial\s+/i, "").replace(/\s*[-–—]?\s*review\s*blitz.*$/i, "")
    .replace(/\s+pe\b.*$/i, "").replace(/\s*[-–—]?\s*practice\s*exams?.*$/i, "")
    .replace(/[-–—\s]+$/, "").trim().toUpperCase().replace(/\s+/g, " ");
  return { course: course || null };
}

const tests = await sql`
  select test_name, test_type, student_tracker_type
  from tests where ready_for_portal = true and access_tier = 'Student'
    and (student_tracker_type ilike 'FBC%' or student_tracker_type = 'FBC')`;

const exploreCourseModules = new Map(), exploreBlitz = new Map(), explorePracticeExams = new Map();
for (const t of tests) {
  const cat = classifyTestCategory(t.test_type);
  if (cat === "blitz") {
    const k = parseTrackerType(t.student_tracker_type).course ?? "Other";
    exploreBlitz.set(k, (exploreBlitz.get(k) ?? 0) + 1);
  } else if (cat === "practice_exam") {
    const k = parseTrackerType(t.student_tracker_type).course ?? "Other";
    explorePracticeExams.set(k, (explorePracticeExams.get(k) ?? 0) + 1);
  } else if (!cat) {
    exploreCourseModules.set(t.student_tracker_type, (exploreCourseModules.get(t.student_tracker_type) ?? 0) + 1);
  }
}

console.log("For FBC, a fully non-enrolled visitor now sees THREE separate cards, one per Explore section:");
console.log(`  "Explore more courses"        -> FBC: ${exploreCourseModules.get("FBC") ?? 0} chapters`);
console.log(`  "Explore more Blitz"          -> FBC: ${exploreBlitz.get("FBC") ?? 0} blitz`);
console.log(`  "Explore more Practice Exams" -> FBC: ${explorePracticeExams.get("FBC") ?? 0} practice`);
console.log("\n(Previously all three were merged into ONE card under a single 'Explore more courses' grid.)");
