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

// A course you don't have (yet): a light, scannable card — not a heavy
// gradient block. CCO-T088 catalog redesign (2026-07-02): this is the "you
// don't own this, here's what exists" surface, so it stays quiet and dense —
// colour is reserved for the small icon chip and the CTA, not a full fill.
// (Previously a full bg-gradient tile per course; with a dozen-plus of these
// stacked in a grid that read as "too dark" — Jakub, 2026-07-02.)
const ICON_CHIP: Record<GroupAccent, string> = {
  purple: "bg-cco-purple/10 text-cco-purple",
  green: "bg-cco-green/15 text-cco-green-600",
  gold: "bg-cco-gold/20 text-cco-gold-dark",
};
const CTA_TEXT: Record<GroupAccent, string> = {
  purple: "text-cco-purple",
  green: "text-cco-green-600",
  gold: "text-cco-gold-dark",
};

// Collapsed by default (the density win), but expands in place to name every
// individual test — never a dead-end aggregate. Spans the full grid row when
// open so a long expanded list doesn't cramp its row-mates.
function LockedTile({ g }: { g: CatalogGroup }) {
  return (
    <details className="group/tile open:col-span-2 open:lg:col-span-3">
      <summary
        className="flex cursor-pointer list-none select-none flex-col gap-3 rounded-xl border border-cco-border/70 bg-cco-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cco-border hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] group-open/tile:rounded-b-none [&::-webkit-details-marker]:hidden"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_CHIP[g.accent]}`}
          >
            <Lock size={16} />
          </span>
          <ChevronDown
            size={16}
            className="mt-1.5 shrink-0 text-cco-muted transition-transform duration-200 group-open/tile:rotate-180"
          />
        </div>
        <div>
          <h3 className="font-heading text-base font-bold leading-tight text-cco-ink">
            {g.title}
          </h3>
          {g.subtitle && (
            <p className="mt-1 text-xs font-medium text-cco-muted">{g.subtitle}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 self-start text-xs font-bold ${CTA_TEXT[g.accent]}`}>
          See what's inside
          <ArrowRight size={12} />
        </span>
      </summary>
      <div className="rounded-b-xl border border-t-0 border-cco-border/70 bg-cco-bg-soft/40 p-3">
        {g.upsell && (
          <a
            href={g.upsell.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm transition hover:-translate-y-px hover:shadow-md ${ACCENT[g.accent].cta}`}
          >
            <Lock size={12} />
            {g.upsell.label}
          </a>
        )}
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {g.cards.map((c) => (
            <TestRow key={c.id} test={c} />
          ))}
        </div>
      </div>
    </details>
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
 * top-level categories, [27:51]: "I'd add two more categories for blitzes
 * and practice exams"); CCO Club and Free CEUs render as untitled sections
 * (their gradient headers already name them).
 *
 * 2026-07-02: `isExplore` marks a section's locked content as a compact,
 * collapsed-by-default grid of expandable cards (LockedTile) rather than
 * always-open accordions — one Explore section per TYPE (courses / blitz /
 * practice), directly under its owned counterpart, not merged across types.
 */
export interface CatalogSection {
  key: string;
  /** Eyebrow heading; omit for tiers that name themselves in-folder. */
  title?: string;
  groups: CatalogGroup[];
  isExplore?: boolean;
}

/**
 * Catalog layout. Owned category sections (Courses → Review Blitzes →
 * Practice Exams) render as bold gradient folders — or, when locked (e.g.
 * Club for a non-subscriber), a prominent locked card. Explore sections
 * render as a compact grid of expandable cards, one per type, so a course
 * you don't own is scannable without dead-ending its individual products.
 */
export function CatalogGroups({ sections }: { sections: CatalogSection[] }) {
  const visible = sections.filter((s) => s.groups.length > 0);
  if (!visible.length) {
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
      {visible.map((section) =>
        section.isExplore ? (
          <section key={section.key} className="space-y-4">
            {section.title && <Eyebrow>{section.title}</Eyebrow>}
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
              {section.groups.map((g) => (
                <LockedTile key={g.key} g={g} />
              ))}
            </div>
          </section>
        ) : (
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
        )
      )}
    </div>
  );
}
