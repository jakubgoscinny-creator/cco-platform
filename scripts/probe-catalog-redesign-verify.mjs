// CCO-T088 catalog redesign (2026-07-02) verification: re-implements the
// merged grouping (courseBadgeLabel + explore-card merge) inline against
// live Neon data, proving the density fix and per-course merge with real
// tracker-type strings. Strictly SELECT.
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
function badgeLabel(c) {
  const p = [];
  if (c.courseModules > 0) p.push(`${c.courseModules} chapter${c.courseModules === 1 ? "" : "s"}`);
  if (c.blitz > 0) p.push(`${c.blitz} blitz`);
  if (c.practiceExams > 0) p.push(`${c.practiceExams} practice`);
  return p.join(" · ");
}

const tests = await sql`
  select test_name, test_type, student_tracker_type, access_tier
  from tests where ready_for_portal = true and access_tier = 'Student'`;

const counts = new Map();
for (const t of tests) {
  const cat = classifyTestCategory(t.test_type);
  const key = cat ? (parseTrackerType(t.student_tracker_type).course ?? "Other") : (t.student_tracker_type ?? "Course");
  if (!counts.has(key)) counts.set(key, { courseModules: 0, blitz: 0, practiceExams: 0 });
  const c = counts.get(key);
  if (cat === "blitz") c.blitz++;
  else if (cat === "practice_exam") c.practiceExams++;
  else if (!cat) c.courseModules++;
}

console.log(`${counts.size} distinct courses would appear in the Explore grid for a fully non-enrolled visitor (was ${tests.length} individual tests scattered across up to 3 sections each).\n`);
for (const [course, c] of [...counts.entries()].sort()) {
  console.log(`${course.padEnd(12)} ${badgeLabel(c)}`);
}
