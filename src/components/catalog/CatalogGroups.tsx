import { ChevronDown, BookOpen, Sparkles, Lock } from "lucide-react";
import { TestRow } from "./TestRow";
import type { TestCardProps } from "./TestCard";

export type GroupAccent = "purple" | "green" | "gold";

export interface CatalogGroup {
  key: string;
  title: string;
  subtitle: string;
  /** Colour identity: purple = a course, green = free, gold = CCO Club. */
  accent: GroupAccent;
  /** Locked = the viewer hasn't paid (no Progress Tracker / not a subscriber).
   *  A locked folder does NOT open — it shows a padlock + an upsell CTA. */
  locked: boolean;
  defaultOpen: boolean;
  /** Total exams in the section (shown in the pill even when locked). */
  count: number;
  /** Rows to reveal — only populated for UNLOCKED folders (locked = []). */
  cards: TestCardProps[];
  /** Upsell target for a locked folder. */
  upsell?: { href: string; label: string };
}

// One brand colour per section type — a left spine + soft tinted badge/pill so
// the colour reads clearly without shouting.
const ACCENT: Record<GroupAccent, { border: string; badge: string; pill: string }> = {
  purple: {
    border: "border-l-cco-purple",
    badge: "bg-cco-purple/10 text-cco-purple",
    pill: "bg-cco-purple/10 text-cco-purple",
  },
  green: {
    border: "border-l-cco-green",
    badge: "bg-cco-green/15 text-cco-green-600",
    pill: "bg-cco-green/15 text-cco-green-600",
  },
  gold: {
    border: "border-l-cco-gold",
    badge: "bg-cco-gold/20 text-cco-gold-dark",
    pill: "bg-cco-gold/20 text-cco-gold-dark",
  },
};

function GroupIcon({ accent, locked }: { accent: GroupAccent; locked: boolean }) {
  if (locked) return <Lock size={16} />;
  if (accent === "green") return <Sparkles size={18} />;
  return <BookOpen size={18} />;
}

/**
 * The catalog as colour-coded, collapsible "shelves" (native <details>, so the
 * toggle is instant — no client JS). A section you've paid for opens to a tidy
 * list of its exams; a section you haven't is locked behind a padlock + upsell
 * (the same technique as the CCO Club tier), so the whole course catalog is
 * visible as a teaser without exposing the exams themselves.
 */
export function CatalogGroups({ groups }: { groups: CatalogGroup[] }) {
  if (!groups.length) {
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
    <div className="space-y-4">
      {groups.map((g) => {
        const a = ACCENT[g.accent];

        // Locked: a static card (no toggle) with a padlock + upsell CTA.
        if (g.locked) {
          return (
            <div
              key={g.key}
              className={`flex items-center gap-3.5 rounded-2xl border border-l-4 border-cco-border ${a.border} bg-cco-card/80 p-4 sm:p-5`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.badge}`}
              >
                <GroupIcon accent={g.accent} locked />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading font-bold leading-tight text-cco-ink">
                  {g.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-cco-muted">{g.subtitle}</p>
              </div>
              <span
                className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${a.pill}`}
              >
                {g.count} {g.count === 1 ? "exam" : "exams"}
              </span>
              {g.upsell && (
                <a
                  href={g.upsell.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-cco-gold px-4 py-2 text-xs font-semibold text-cco-ink no-underline transition hover:-translate-y-px hover:bg-cco-gold-dark hover:shadow-md"
                >
                  <Lock size={13} />
                  {g.upsell.label}
                </a>
              )}
            </div>
          );
        }

        // Unlocked: an expandable folder.
        return (
          <details
            key={g.key}
            open={g.defaultOpen}
            className={`group/folder overflow-hidden rounded-2xl border border-l-4 border-cco-border ${a.border} bg-cco-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow open:shadow-[0_10px_34px_rgba(15,23,42,0.07)]`}
          >
            <summary className="flex cursor-pointer list-none select-none items-center gap-3.5 p-4 transition-colors hover:bg-cco-bg-soft/60 sm:p-5 [&::-webkit-details-marker]:hidden">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.badge}`}
              >
                <GroupIcon accent={g.accent} locked={false} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading font-bold leading-tight text-cco-ink">
                  {g.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-cco-muted">{g.subtitle}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${a.pill}`}
              >
                {g.count} {g.count === 1 ? "exam" : "exams"}
              </span>
              <ChevronDown
                size={18}
                className="shrink-0 text-cco-muted transition-transform duration-200 group-open/folder:rotate-180"
              />
            </summary>
            <div className="px-3 pb-3 sm:px-4">
              <div className="divide-y divide-cco-border/60 border-t border-cco-border pt-1.5">
                {g.cards.map((c) => (
                  <TestRow key={c.id} test={c} />
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
