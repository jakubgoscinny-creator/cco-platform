import { Suspense } from "react";
import { getActiveTests, getDomainNames } from "@/lib/sync";
import { CatalogGroups, type CatalogGroup, type GroupAccent } from "@/components/catalog/CatalogGroups";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogHero } from "@/components/catalog/CatalogHero";
import { DataLineage } from "@/components/shared/DataLineage";
import { timeOfDayGreeting, firstName } from "@/components/shared/PageHeader";
import { getSessionContact } from "@/lib/auth";
import { canAccessTest, normalizeAccessTier } from "@/lib/circle-access";
import type { TestCardProps } from "@/components/catalog/TestCard";
import type { Test } from "@/lib/schema";

// Upsell targets for locked sections. The Club link is the live one; the course
// link is a placeholder until we confirm the real per-course / courses-catalog
// enrol URL with Laureen (see CCO-T044 catalog notes).
const CLUB_URL = "https://cco.us/club#price";
const COURSE_ENROL_URL = "https://www.cco.us";

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
    return { key: "free", title: "Free CEU Quizzes", accent: "green", kind: "free", order: 2 };
  if (tier === "Club")
    return { key: "club", title: "CCO Club", accent: "gold", kind: "club", order: 3 };
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

  const toCard = (t: Test): TestCardProps => ({
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
  });

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
          ? "Enrol to unlock this course's chapter exams"
          : "Chapter exams for your enrolled course";
        if (locked) upsell = { href: COURSE_ENROL_URL, label: "Enrol to unlock" };
      }

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
      };
    });

  const sections = groups.length;
  const unlocked = groups.filter((g) => !g.locked).length;

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

      <p className="mb-4 text-sm text-cco-muted">
        {sections} {sections === 1 ? "section" : "sections"}
        {unlocked > 0 && ` · ${unlocked} unlocked`}
      </p>

      <CatalogGroups groups={groups} />
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
