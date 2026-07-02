import { Suspense } from "react";
import { getActiveTests, getDomainNames } from "@/lib/sync";
import {
  CatalogGroups,
  type CatalogGroup,
  type CatalogSection,
  type GroupAccent,
} from "@/components/catalog/CatalogGroups";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { DataLineage } from "@/components/shared/DataLineage";
import { timeOfDayGreeting, firstName } from "@/components/shared/PageHeader";
import { getSessionContact } from "@/lib/auth";
import { getLegacyResultsForContact } from "@/lib/legacy-results";
import { canAccessTest, normalizeAccessTier } from "@/lib/circle-access";
import { CLUB_URL, courseEnrolUrl } from "@/lib/course-links";
import {
  classifyTestCategory,
  courseBadgeLabel,
  courseGroupTitle,
  deriveCourseKey,
  type CourseExploreCounts,
  type TestCategory,
} from "@/lib/test-categories";
import type { TestCardProps } from "@/components/catalog/TestCard";
import type { Test } from "@/lib/schema";

type GroupKind = "course" | "free" | "club" | "category";
type GroupMeta = {
  key: string;
  title: string;
  accent: GroupAccent;
  kind: GroupKind;
  /** For kind "category": which Blitz/PE bucket this tile belongs to. */
  category?: TestCategory;
  /** For a per-course category tile (blitz / practice_exam): the course key. */
  courseKey?: string;
};

// CCO-T088: the catalog is organised (6/25 call) as three top-level categories —
// Courses, Review Blitzes, Practice Exams — driven by the test-level category
// field (Podio "Type" → tests.testType). Within Blitz/PE, a course's tests are
// grouped into one tile (e.g. the PBC gemstones Ruby/Sapphire/Topaz under "PBC
// Practice Exams"), individually padlocked. The old combined "Blitz/Practice
// Exam" category is kept as a fallback bucket for any test not yet re-tagged.
// Gating is unchanged — canAccessTest still decides access per test.
function groupFor(test: Test): GroupMeta {
  const tier = normalizeAccessTier(test.accessTier);
  if (tier === "Free")
    return { key: "free", title: "Free CEU Quizzes", accent: "green", kind: "free" };
  if (tier === "Club")
    return { key: "club", title: "CCO Club", accent: "gold", kind: "club" };

  const category = classifyTestCategory(test.testType);
  if (category === "blitz_practice_combo") {
    // Fallback: untagged combo tests share one flat tile rather than scattering.
    return {
      key: "category:combo",
      title: "Blitz & Practice Exams",
      accent: "purple",
      kind: "category",
      category,
    };
  }
  if (category === "blitz" || category === "practice_exam") {
    const courseKey = deriveCourseKey(test.studentTrackerType) ?? "Other";
    return {
      key: `category:${category}:${courseKey}`,
      title: courseGroupTitle(courseKey, category),
      accent: "purple",
      kind: "category",
      category,
      courseKey,
    };
  }

  const code = test.studentTrackerType || "Course";
  return { key: `course:${code}`, title: code, accent: "purple", kind: "course" };
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

  const toCard = (
    t: Test,
    opts?: { locked?: boolean; unlockUrl?: string }
  ): TestCardProps => {
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
      locked: opts?.locked ?? false,
      unlockUrl: opts?.unlockUrl,
      passed: d?.passed ?? false,
      attempted: d?.attempted ?? false,
      scorePercent: d?.score ?? null,
    };
  };

  // Accumulate each visible test into its group, remembering whether the viewer
  // can actually take it (canAccessTest — the single gating source of truth).
  const acc = new Map<
    string,
    { meta: GroupMeta; entries: { test: Test; allowed: boolean }[] }
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
      g = { meta, entries: [] };
      acc.set(meta.key, g);
    }
    g.entries.push({
      test: t,
      allowed: canAccessTest(t, userForGating) === "allowed",
    });
  }

  type BuiltGroup = CatalogGroup & {
    kind: GroupKind;
    category?: TestCategory;
  };

  // CCO-T088 catalog redesign (2026-07-02): a course you own NOTHING in — no
  // Course Module, no Blitz, no Practice Exam — merges into ONE "Explore more
  // courses" grid card instead of up to 3 separate full-width accordion
  // tiles. (The first T088 cut showed every category as its own always-open
  // accordion regardless of ownership: 16-18 tiles stacked ~3000px tall for a
  // non-enrolled visitor. Jakub: "we had a lovely catalog, and now it's a
  // little bit shit... a lot of clicking.") A course you own SOMETHING in
  // keeps the rich accordion treatment for that owned slice — unaffected.
  //
  // The merged card stays COLLAPSED by default (the density win) but is
  // itself expandable, carrying every individual test by name — never a
  // dead-end count-only card. (Audit 2026-07-02: yesterday's catalog gave
  // each distinct product, e.g. "PBC PE - Ruby", its own visible locked
  // tile; a pure aggregate count here would have silently hidden 33 named
  // products behind 9 generic course cards. Jakub: "I really need this to
  // work the way we discussed... don't want anyone missing out on
  // potentially buying stuff." Named-product visibility is preserved on
  // expand — density and discoverability, not one traded for the other.)
  const exploreCounts = new Map<
    string,
    { title: string; unlockUrl: string; counts: CourseExploreCounts; cards: TestCardProps[] }
  >();
  const addExplore = (
    courseKey: string,
    unlockUrl: string,
    field: keyof CourseExploreCounts,
    newCards: TestCardProps[]
  ) => {
    let e = exploreCounts.get(courseKey);
    if (!e) {
      e = {
        title: courseKey,
        unlockUrl,
        counts: { courseModules: 0, blitz: 0, practiceExams: 0 },
        cards: [],
      };
      exploreCounts.set(courseKey, e);
    }
    e.counts[field] += newCards.length;
    e.cards.push(...newCards);
  };

  const built: BuiltGroup[] = [];
  for (const { meta, entries } of acc.values()) {
    const accessible = entries.filter((e) => e.allowed);
    const total = entries.length;
    const locked = accessible.length === 0;

    // Per-course Blitz / Practice-Exam tile: only rendered as its own
    // accordion when the viewer owns at least one test in it — otherwise it
    // merges into the Explore grid (below).
    if (meta.kind === "category" && meta.category !== "blitz_practice_combo") {
      const unlockUrl = courseEnrolUrl(meta.courseKey ?? null);
      if (locked) {
        addExplore(
          meta.courseKey ?? "Other",
          unlockUrl,
          meta.category === "blitz" ? "blitz" : "practiceExams",
          entries.map((e) => toCard(e.test, { locked: true, unlockUrl }))
        );
        continue;
      }
      const cards = entries
        .map((e) => toCard(e.test, { locked: !e.allowed, unlockUrl }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const done = cards.filter((c) => c.passed).length;
      built.push({
        key: meta.key,
        title: meta.title,
        // Only reached when locked === false — a fully-locked category tile
        // merges into the Explore grid above instead (see addExplore).
        subtitle:
          meta.category === "blitz"
            ? "Rapid review blitz exams — take the ones you've unlocked"
            : "Full-length practice exams — take the ones you've unlocked",
        accent: meta.accent,
        locked: false,
        defaultOpen: total <= 6,
        count: total,
        cards,
        progress: cards.length > 0 ? { done, total: cards.length } : undefined,
        kind: meta.kind,
        category: meta.category,
      });
      continue;
    }

    // Course (Course Module) tiles: same rule — locked ones merge into the
    // Explore grid instead of the old per-course locked accordion/card.
    if (meta.kind === "course" && locked) {
      const unlockUrl = courseEnrolUrl(meta.title);
      addExplore(
        meta.title,
        unlockUrl,
        "courseModules",
        entries.map((e) => toCard(e.test, { locked: true, unlockUrl }))
      );
      continue;
    }

    // The combo fallback (untagged Blitz/PE data) is a safety bucket, not an
    // upsell surface — hide entirely when nothing in it is accessible.
    if (meta.kind === "category" && locked) continue;

    const sorted = accessible
      .map((e) => toCard(e.test))
      .sort((a, b) => a.name.localeCompare(b.name));

    let subtitle: string;
    let upsell: CatalogGroup["upsell"];
    if (meta.kind === "free") {
      subtitle = "Open to everyone — no membership needed";
    } else if (meta.kind === "club") {
      subtitle = locked ? "CCO Club members only" : "Included with your membership";
      if (locked) upsell = { href: CLUB_URL, label: "Join CCO Club" };
    } else if (meta.kind === "category") {
      subtitle = "Blitz & practice exams for your enrolled courses";
    } else {
      // Only reached when locked === false — a fully-locked course-module
      // tile merges into the Explore grid above instead (see addExplore).
      subtitle = "Chapter exams for your enrolled course";
    }

    const done = sorted.filter((c) => c.passed).length;
    built.push({
      key: meta.key,
      title: meta.title,
      subtitle,
      accent: meta.accent,
      locked,
      // Big course folders + locked sections stay collapsed; auto-open only
      // small, takeable sections (e.g. the couple of free CEUs).
      defaultOpen: !locked && total <= 6,
      count: total,
      cards: sorted,
      upsell,
      progress:
        !locked && sorted.length > 0 ? { done, total: sorted.length } : undefined,
      kind: meta.kind,
      category: meta.category,
    });
  }

  // One card per course, badge-labelled by what's inside (e.g. "17 chapters
  // · 9 blitz · 4 practice"), for the Explore grid — collapsed by default,
  // but carries every individual test by name (`cards`) so expanding it
  // never dead-ends; nothing that named a specific product yesterday is
  // unreachable today, just one click deeper.
  const lockedCourses: BuiltGroup[] = [...exploreCounts.entries()]
    .map(([courseKey, { title, unlockUrl, counts, cards }]) => ({
      key: `explore:${courseKey}`,
      title,
      subtitle: courseBadgeLabel(counts),
      accent: "purple" as GroupAccent,
      locked: true,
      defaultOpen: false,
      count: counts.courseModules + counts.blitz + counts.practiceExams,
      cards: cards.sort((a, b) => a.name.localeCompare(b.name)),
      upsell: { href: unlockUrl, label: "Enroll to unlock" },
      kind: "course" as GroupKind,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const byTitle = (a: CatalogGroup, b: CatalogGroup) =>
    a.title.localeCompare(b.title);

  // CCO-T088 layout: three purple category bands (Your Courses → Review Blitzes
  // → Practice Exams) hold ONLY owned content now; every locked course — Course
  // Module, Blitz, or Practice Exam alike — merged into `lockedCourses` above.
  const enrolledCourses = built.filter((g) => g.kind === "course").sort(byTitle);
  const blitzTiles = built.filter((g) => g.category === "blitz").sort(byTitle);
  const peTiles = built.filter((g) => g.category === "practice_exam").sort(byTitle);
  const comboTiles = built
    .filter((g) => g.category === "blitz_practice_combo")
    .sort(byTitle);

  const sections: CatalogSection[] = [
    {
      key: "courses",
      title: enrolledCourses.length ? "Your Courses" : undefined,
      groups: enrolledCourses,
    },
    { key: "blitzes", title: "Review Blitzes", groups: blitzTiles },
    { key: "practice-exams", title: "Practice Exams", groups: peTiles },
    { key: "combo", title: "Blitz & Practice Exams", groups: comboTiles },
    { key: "club", groups: built.filter((g) => g.kind === "club") },
    { key: "free", groups: built.filter((g) => g.kind === "free") },
  ];

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

      <CatalogGroups sections={sections} lockedCourses={lockedCourses} />
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
