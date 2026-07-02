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
  courseGroupTitle,
  deriveCourseKey,
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

  const built: BuiltGroup[] = [];
  for (const { meta, entries } of acc.values()) {
    const accessible = entries.filter((e) => e.allowed);
    const total = entries.length;

    // Per-course Blitz / Practice-Exam tile (CCO-T088): show EVERY test in the
    // course's tile with individual padlocks (bought Ruby → Ruby open,
    // Sapphire/Topaz padlocked). CCO-T044 (2026-05-29) established that every
    // section shows as a folder — a fully-locked one stays visible as an
    // upsell, never hidden. (Regression found 2026-07-02: an earlier version
    // of this block hid the tile entirely when accessible.length === 0,
    // silently dropping whole courses like PBB from view for anyone not
    // enrolled — reverted to match the established pattern.)
    if (meta.kind === "category" && meta.category !== "blitz_practice_combo") {
      const locked = accessible.length === 0;
      const unlockUrl = courseEnrolUrl(meta.courseKey ?? null);
      const cards = entries
        .map((e) => toCard(e.test, { locked: !e.allowed, unlockUrl }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const done = cards.filter((c) => c.passed).length;
      built.push({
        key: meta.key,
        title: meta.title,
        subtitle: locked
          ? meta.category === "blitz"
            ? "Enroll to unlock these review blitz exams"
            : "Enroll to unlock these practice exams"
          : meta.category === "blitz"
            ? "Rapid review blitz exams — take the ones you've unlocked"
            : "Full-length practice exams — take the ones you've unlocked",
        accent: meta.accent,
        // Always an open folder (never LockedCard) — individual per-card
        // padlocks (toCard above) already carry the enrol link, even when
        // every card in the tile is locked.
        locked: false,
        defaultOpen: !locked && total <= 6,
        count: total,
        cards,
        progress: cards.length > 0 ? { done, total: cards.length } : undefined,
        kind: meta.kind,
        category: meta.category,
      });
      continue;
    }

    // Course / Club / Free / combo-fallback: homogeneous all-or-nothing lock —
    // accessible cards shown, an inaccessible section locks behind its upsell.
    const locked = accessible.length === 0;
    // The combo fallback is a safety bucket, not an upsell — hide when empty.
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
      subtitle = locked
        ? "Enroll to unlock this course's chapter exams"
        : "Chapter exams for your enrolled course";
      // meta.title is the Progress-Tracker-Type code for course folders;
      // deep-link the lock to that course's cco.us sales page (CCO-T061).
      if (locked) upsell = { href: courseEnrolUrl(meta.title), label: "Enroll to unlock" };
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

  const byTitle = (a: CatalogGroup, b: CatalogGroup) =>
    a.title.localeCompare(b.title);

  // CCO-T088 layout: three purple category bands (Your Courses → Review Blitzes
  // → Practice Exams), then the combo fallback, then Club / Free tiers; locked
  // COURSES drop into the compact "Explore more courses" grid below.
  const courseGroups = built.filter((g) => g.kind === "course");
  const enrolledCourses = courseGroups.filter((g) => !g.locked).sort(byTitle);
  const lockedCourses = courseGroups.filter((g) => g.locked).sort(byTitle);
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
