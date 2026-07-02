import { Suspense } from "react";
import { getActiveTests, getDomainNames } from "@/lib/sync";
import { CatalogGroups, type CatalogGroup, type GroupAccent } from "@/components/catalog/CatalogGroups";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { DataLineage } from "@/components/shared/DataLineage";
import { timeOfDayGreeting, firstName } from "@/components/shared/PageHeader";
import { getSessionContact } from "@/lib/auth";
import { getLegacyResultsForContact } from "@/lib/legacy-results";
import { canAccessTest, normalizeAccessTier } from "@/lib/circle-access";
import { CLUB_URL, courseEnrolUrl } from "@/lib/course-links";
import type { TestCardProps } from "@/components/catalog/TestCard";
import type { Test } from "@/lib/schema";

type GroupKind = "course" | "free" | "club";
type GroupMeta = {
  key: string;
  title: string;
  accent: GroupAccent;
  kind: GroupKind;
  order: number;
};

function groupFor(test: Test): GroupMeta {
  const tier = normalizeAccessTier(test.accessTier);
  if (tier === "Free")
    return { key: "free", title: "Free CEU Quizzes", accent: "green", kind: "free", order: 3 };
  if (tier === "Club")
    return { key: "club", title: "CCO Club", accent: "gold", kind: "club", order: 2 };
  const code = test.studentTrackerType || "Course";
  return { key: `course:${code}`, title: code, accent: "purple", kind: "course", order: 1 };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const searchQuery =
    typeof params?.q === "string" ? params.q.toLowerCase() : "";

  const user = await getSessionContact();
  const greet = user?.fullName ? firstName(user.fullName) : null;

  const allTests = await getActiveTests();

  const allDomainIds = [...new Set(allTests.flatMap((t) => t.domainIds ?? []))];
  const domainNameMap = await getDomainNames(allDomainIds);

  const userForGating = {
    subscriptionStatus: user?.subscriptionStatus ?? null,
    enrolledTrackerTypes: user?.enrolledTrackerTypes ?? null,
  };

  // Search-only filter — categorisation is the collapsible colour-coded folders.
  const matches = (t: Test) =>
    !searchQuery ||
    t.testName.toLowerCase().includes(searchQuery) ||
    stripHtml(t.description ?? "").toLowerCase().includes(searchQuery);

  // CCO-T046: the student's completion per exam (passed / best score), from the
  // Neon legacy_test_results mirror (Test Results). Matched by Tests item_id,
  // with a test-name fallback. Resilient — a failure just drops the progress
  // marks, never the catalog.
  type Done = { passed: boolean; attempted: boolean; score: number | null };
  const maxScore = (x: number | null, y: number | null) => {
    const vals = [x, y].filter((s): s is number => s != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const better = (a: Done | undefined, b: Done): Done =>
    !a ? b : { passed: a.passed || b.passed, attempted: true, score: maxScore(a.score, b.score) };
  const byId = new Map<number, Done>();
  const byName = new Map<string, Done>();
  if (user) {
    try {
      const results = await getLegacyResultsForContact(user.contactId);
      for (const r of results) {
        const d: Done = {
          passed: r.passed === true,
          attempted: true,
          score: r.scorePercent != null ? Number(r.scorePercent) : null,
        };
        if (r.testItemId) byId.set(r.testItemId, better(byId.get(r.testItemId), d));
        if (r.testName) {
          const k = r.testName.trim().toLowerCase();
          byName.set(k, better(byName.get(k), d));
        }
      }
    } catch (err) {
      console.error("CCO-T046: completion lookup failed (non-fatal):", err);
    }
  }
  const completionFor = (t: Test): Done | undefined =>
    byId.get(t.podioItemId) ?? byName.get(t.testName.trim().toLowerCase());

  const toCard = (t: Test): TestCardProps => {
    const d = completionFor(t);
    return {
      id: t.podioItemId,
      name: t.testName,
      description: t.description,
      testType: t.testType,
      questionCount: t.questionCount,
      timeLimitMinutes: t.timeLimitMinutes,
      passingScore: t.passingScore,
      domainNames: (t.domainIds ?? [])
        .map((id) => domainNameMap.get(id))
        .filter((n): n is string => !!n),
      locked: false,
      passed: d?.passed ?? false,
      attempted: d?.attempted ?? false,
      scorePercent: d?.score ?? null,
    };
  };

  // CCO-T044 (2026-05-29 evolution): show EVERY section as a folder. A section
  // the viewer can access opens to its exam rows; one they can't is locked
  // behind a padlock + upsell (no rows revealed). The server action still
  // enforces access, so a locked folder can't be bypassed.
  const acc = new Map<
    string,
    { meta: GroupMeta; count: number; cards: TestCardProps[] }
  >();
  for (const t of allTests) {
    if (!t.testName || !matches(t)) continue;
    // Skip misconfigured Student tests (no tracker type) — they'd form a junk
    // "Course" folder and are already flagged for Mary; fail-closed = hidden.
    if (
      normalizeAccessTier(t.accessTier) === "Student" &&
      (!t.studentTrackerType || t.studentTrackerType === "NA")
    )
      continue;
    const meta = groupFor(t);
    let g = acc.get(meta.key);
    if (!g) {
      g = { meta, count: 0, cards: [] };
      acc.set(meta.key, g);
    }
    g.count += 1;
    if (canAccessTest(t, userForGating) === "allowed") g.cards.push(toCard(t));
  }

  const groups: CatalogGroup[] = [...acc.values()]
    .sort((a, b) => {
      // Your unlocked (accessible) sections first, then the locked upsells.
      const al = a.cards.length === 0 ? 1 : 0;
      const bl = b.cards.length === 0 ? 1 : 0;
      return (
        al - bl ||
        a.meta.order - b.meta.order ||
        a.meta.title.localeCompare(b.meta.title)
      );
    })
    .map(({ meta, count, cards }) => {
      // Homogeneous sections: if no card is accessible, the whole folder locks.
      const locked = cards.length === 0;
      const sorted = [...cards].sort((a, b) => a.name.localeCompare(b.name));

      let subtitle: string;
      let upsell: CatalogGroup["upsell"];
      if (meta.kind === "free") {
        subtitle = "Open to everyone — no membership needed";
      } else if (meta.kind === "club") {
        subtitle = locked ? "CCO Club members only" : "Included with your membership";
        if (locked) upsell = { href: CLUB_URL, label: "Join CCO Club" };
      } else {
        subtitle = locked
          ? "Enroll to unlock this course's chapter exams"
          : "Chapter exams for your enrolled course";
        // meta.title is the Progress-Tracker-Type code for course folders;
        // deep-link the lock to that course's cco.us sales page (CCO-T061).
        if (locked) upsell = { href: courseEnrolUrl(meta.title), label: "Enroll to unlock" };
      }

      const done = sorted.filter((c) => c.passed).length;

      return {
        key: meta.key,
        title: meta.title,
        subtitle,
        accent: meta.accent,
        locked,
        // Big course folders + locked sections stay collapsed; auto-open only
        // small, takeable sections (e.g. the couple of free CEUs).
        defaultOpen: !locked && count <= 6,
        count,
        cards: sorted,
        upsell,
        progress:
          !locked && sorted.length > 0 ? { done, total: sorted.length } : undefined,
      };
    });

  // CCO-T046: section layout. Locked COURSES go to the compact "Explore more
  // courses" grid; everything else (your course folders, CCO Club, Free CEUs)
  // stays a full-width section in tier order — your courses, then Club (above
  // Free, so the hierarchy reads), then Free.
  const rank: Record<GroupAccent, number> = { purple: 1, gold: 2, green: 3 };
  const isLockedCourse = (g: CatalogGroup) => g.accent === "purple" && g.locked;
  const lockedCourses = groups
    .filter(isLockedCourse)
    .sort((a, b) => a.title.localeCompare(b.title));
  const topSections = groups
    .filter((g) => !isLockedCourse(g))
    .sort((a, b) => rank[a.accent] - rank[b.accent] || a.title.localeCompare(b.title));

  const latestSync = allTests.reduce<Date | null>((latest, t) => {
    if (!t.syncedAt) return latest;
    const d = new Date(t.syncedAt);
    return !latest || d > latest ? d : latest;
  }, null);

  return (
    <div>
      <CatalogHero
        eyebrow="CCO Academy · Exam Catalog"
        title={greet ? `${timeOfDayGreeting()}, ${greet}` : "Your exam catalog"}
        subtitle="Pick up where you left off, or start a new CEU quiz. Every exam you complete brings you closer to certified."
        right={<DataLineage syncedAt={latestSync} />}
      />

      <Suspense fallback={null}>
        <CatalogFilters />
      </Suspense>

      <CatalogGroups top={topSections} lockedCourses={lockedCourses} />
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
