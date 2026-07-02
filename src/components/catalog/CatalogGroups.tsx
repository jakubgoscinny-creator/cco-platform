import { type ReactNode } from "react";
import { ChevronDown, BookOpen, Sparkles, Lock, ArrowRight } from "lucide-react";
import { TestRow } from "./TestRow";
import type { TestCardProps } from "./TestCard";

export type GroupAccent = "purple" | "green" | "gold";

export interface CatalogGroup {
  key: string;
  title: string;
  subtitle: string;
  /** Colour identity: purple = a course, green = free, gold = CCO Club. */
  accent: GroupAccent;
  locked: boolean;
  defaultOpen: boolean;
  count: number;
  cards: TestCardProps[];
  upsell?: { href: string; label: string };
  /** CCO-T046: passed / total for an unlocked folder — drives the progress bar. */
  progress?: { done: number; total: number };
}

// Bold, confident colour system — full brand gradients with contrast-safe text
// (white on the dark purple; ink on the bright green/gold). Gold ↔ purple play
// off each other for the unlock CTAs.
const ACCENT: Record<
  GroupAccent,
  { grad: string; text: string; countPill: string; cta: string }
> = {
  purple: {
    grad: "from-cco-purple to-cco-purple-700",
    text: "text-white",
    countPill: "bg-white/20 text-white",
    cta: "bg-cco-gold text-cco-ink hover:bg-cco-gold-dark",
  },
  green: {
    grad: "from-cco-green to-cco-green-600",
    text: "text-cco-ink",
    countPill: "bg-black/10 text-cco-ink",
    cta: "bg-cco-ink text-white hover:bg-cco-slate",
  },
  gold: {
    grad: "from-cco-gold to-cco-gold-dark",
    text: "text-cco-ink",
    countPill: "bg-black/10 text-cco-ink",
    cta: "bg-cco-purple text-white hover:bg-cco-purple-600",
  },
};

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 font-heading text-sm font-bold uppercase tracking-[0.12em] text-cco-ink">
      {children}
    </h2>
  );
}

// A section you can take: a bold gradient header that opens to a clean list.
function OpenFolder({ g }: { g: CatalogGroup }) {
  const a = ACCENT[g.accent];
  const Icon = g.accent === "green" ? Sparkles : BookOpen;
  return (
    <details
      open={g.defaultOpen}
      className="group/folder overflow-hidden rounded-2xl shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-shadow open:shadow-[0_14px_40px_rgba(15,23,42,0.12)]"
    >
      <summary
        className={`flex cursor-pointer list-none select-none items-center gap-3.5 bg-gradient-to-br ${a.grad} ${a.text} p-4 transition-[filter] hover:brightness-[1.04] sm:p-5 [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-lg font-extrabold leading-tight">
            {g.title}
          </h3>
          {g.progress && g.progress.total > 0 ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/15 sm:w-40">
                <div
                  className="h-full rounded-full bg-cco-gold"
                  style={{
                    width: `${Math.round((g.progress.done / g.progress.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs font-bold opacity-90">
                {g.progress.done}/{g.progress.total} passed
              </span>
            </div>
          ) : (
            <p className="mt-0.5 truncate text-xs font-medium opacity-80">{g.subtitle}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${a.countPill}`}>
          {g.count} {g.count === 1 ? "exam" : "exams"}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 transition-transform duration-200 group-open/folder:rotate-180 ${a.text}`}
        />
      </summary>
      <div className="bg-cco-card px-3 pb-3 pt-2.5 sm:px-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {g.cards.map((c) => (
            <TestRow key={c.id} test={c} />
          ))}
        </div>
      </div>
    </details>
  );
}

// A section you can't take yet: a bold gradient "course card" upsell tile.
function LockedTile({ g }: { g: CatalogGroup }) {
  const a = ACCENT[g.accent];
  return (
    <a
      href={g.upsell?.href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/tile relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${a.grad} ${a.text} p-5 no-underline shadow-[0_4px_16px_rgba(15,23,42,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.18)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-xl font-extrabold leading-tight">{g.title}</h3>
        <Lock size={16} className="mt-1 shrink-0 opacity-70" />
      </div>
      <p className="mt-2 font-heading text-3xl font-black leading-none">
        {g.count}
        <span className="ml-1.5 align-baseline text-sm font-semibold opacity-75">
          {g.count === 1 ? "exam" : "exams"}
        </span>
      </p>
      <span
        className={`mt-5 inline-flex items-center gap-1.5 self-start rounded-full px-4 py-1.5 text-xs font-bold shadow-sm transition-all group-hover/tile:gap-2.5 ${a.cta}`}
      >
        {g.upsell?.label ?? "Locked"}
        <ArrowRight size={13} />
      </span>
    </a>
  );
}

// A full-width locked section — used for CCO Club when you're not a subscriber:
// prominent, sits above the free tier, carries its own upsell CTA.
function LockedCard({ g }: { g: CatalogGroup }) {
  const a = ACCENT[g.accent];
  return (
    <div
      className={`flex items-center gap-3.5 rounded-2xl bg-gradient-to-br ${a.grad} ${a.text} p-4 shadow-[0_4px_16px_rgba(15,23,42,0.10)] sm:p-5`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
        <Lock size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-heading text-lg font-extrabold leading-tight">
          {g.title}
        </h3>
        <p className="mt-0.5 truncate text-xs font-medium opacity-80">{g.subtitle}</p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-black/10 px-3 py-1 text-xs font-bold sm:inline">
        {g.count} {g.count === 1 ? "exam" : "exams"}
      </span>
      {g.upsell && (
        <a
          href={g.upsell.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition hover:-translate-y-px hover:shadow-md ${a.cta}`}
        >
          <Lock size={13} />
          {g.upsell.label}
        </a>
      )}
    </div>
  );
}

/**
 * CCO-T088: a labelled band of folders/cards. Courses / Review Blitzes /
 * Practice Exams each get their own titled section (the 6/25 call's three
 * top-level categories); CCO Club and Free CEUs render as untitled sections
 * (their gradient headers already name them).
 */
export interface CatalogSection {
  key: string;
  /** Eyebrow heading; omit for tiers that name themselves in-folder. */
  title?: string;
  groups: CatalogGroup[];
}

/**
 * Catalog layout. Titled category sections (Courses → Review Blitzes → Practice
 * Exams) and the CCO Club / Free tiers render as bold gradient folders — or,
 * when locked (e.g. Club for a non-subscriber), a prominent locked card. Locked
 * COURSES drop into a compact "Explore more courses" upsell grid below.
 */
export function CatalogGroups({
  sections,
  lockedCourses,
}: {
  sections: CatalogSection[];
  lockedCourses: CatalogGroup[];
}) {
  const visible = sections.filter((s) => s.groups.length > 0);
  if (!visible.length && !lockedCourses.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-cco-muted">No exams found</p>
        <p className="mt-1 text-sm text-cco-muted">
          Try a different search, or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {visible.map((section) => (
        <section key={section.key} className="space-y-4">
          {section.title && <Eyebrow>{section.title}</Eyebrow>}
          {section.groups.map((g) =>
            g.locked ? (
              <LockedCard key={g.key} g={g} />
            ) : (
              <OpenFolder key={g.key} g={g} />
            )
          )}
        </section>
      ))}

      {lockedCourses.length > 0 && (
        <section>
          <Eyebrow>Explore more courses</Eyebrow>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
            {lockedCourses.map((g) => (
              <LockedTile key={g.key} g={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
