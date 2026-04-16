import Link from "next/link";
import { Play, ChevronRight, Trophy, Clock, Calendar } from "lucide-react";
import { Pill } from "@/components/shared/Pill";

export interface GradebookRow {
  attemptId: number;
  testName: string;
  date: string;
  status: string; // 'in_progress' | 'submitted' | 'timed_out'
  scorePercent: number | null;
  timeTaken: string | null;
  domainScores: Record<string, { correct: number; total: number }> | null;
}

export function GradebookTable({ rows }: { rows: GradebookRow[] }) {
  if (!rows.length) {
    return (
      <div className="text-center py-16 rounded-2xl border border-dashed border-cco-border bg-white">
        <p className="text-cco-muted text-lg font-heading font-bold">
          No exam attempts yet
        </p>
        <p className="text-cco-muted text-sm mt-1">
          Start an exam from the catalog to see your history here.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-cco-purple text-white text-sm font-semibold no-underline transition hover:bg-cco-purple-600"
        >
          Browse catalog
          <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* --------- MOBILE + TABLET: card tiles --------- */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => (
          <GradebookCard key={row.attemptId} row={row} />
        ))}
      </div>

      {/* --------- DESKTOP: full table with clickable rows --------- */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-cco-border bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f3f5fa]">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
                Exam
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
                Date
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
                Score
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
                Time
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cco-muted w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href =
                row.status === "in_progress"
                  ? `/exam/take/${row.attemptId}`
                  : `/exam/results/${row.attemptId}`;
              return (
                <tr
                  key={row.attemptId}
                  className="border-t border-cco-border hover:bg-cco-bg-soft transition-colors cursor-pointer group"
                >
                  <RowLink href={href}>
                    <span className="font-medium text-cco-ink group-hover:text-cco-purple transition-colors">
                      {row.testName}
                    </span>
                  </RowLink>
                  <RowLink href={href}>
                    <span className="text-sm text-cco-muted">{row.date}</span>
                  </RowLink>
                  <RowLink href={href}>
                    <StatusPill status={row.status} />
                  </RowLink>
                  <RowLink href={href}>
                    {row.scorePercent != null ? (
                      <span
                        className={`text-sm font-semibold ${scoreColor(row.scorePercent)}`}
                      >
                        {row.scorePercent}%
                      </span>
                    ) : (
                      <span className="text-sm text-cco-muted">--</span>
                    )}
                  </RowLink>
                  <RowLink href={href}>
                    <span className="text-sm text-cco-muted">
                      {row.timeTaken ?? "--"}
                    </span>
                  </RowLink>
                  <RowLink href={href} align="right">
                    <ChevronRight
                      size={16}
                      className="text-cco-muted group-hover:text-cco-purple transition-colors"
                    />
                  </RowLink>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Renders a cell whose content is a Link covering the entire cell area —
 * clicking anywhere in the row navigates. Table-cell padding is applied
 * on the anchor so hit target is the full cell. */
function RowLink({
  href,
  children,
  align = "left",
}: {
  href: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className="p-0">
      <Link
        href={href}
        className={`block px-5 py-3.5 no-underline ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        {children}
      </Link>
    </td>
  );
}

/** Mobile/tablet card variant — full-bleed clickable tile */
function GradebookCard({ row }: { row: GradebookRow }) {
  const href =
    row.status === "in_progress"
      ? `/exam/take/${row.attemptId}`
      : `/exam/results/${row.attemptId}`;
  const isInProgress = row.status === "in_progress";

  return (
    <Link
      href={href}
      className="block bg-white border border-cco-border rounded-2xl p-4 no-underline shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-cco-purple/40 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-bold text-cco-ink leading-snug line-clamp-2 mb-1.5">
            {row.testName}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-cco-muted">
            <Calendar size={10} />
            <span>{row.date}</span>
          </div>
        </div>
        <StatusPill status={row.status} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-cco-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Trophy
              size={14}
              className={
                row.scorePercent != null
                  ? scoreColor(row.scorePercent).replace("text-", "text-")
                  : "text-cco-muted"
              }
            />
            {row.scorePercent != null ? (
              <span
                className={`text-sm font-bold ${scoreColor(row.scorePercent)}`}
              >
                {row.scorePercent}%
              </span>
            ) : (
              <span className="text-sm text-cco-muted">--</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-cco-muted">
            <Clock size={12} />
            <span className="text-xs">{row.timeTaken ?? "--"}</span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
            isInProgress ? "text-cco-purple" : "text-cco-purple/70"
          }`}
        >
          {isInProgress ? (
            <>
              <Play size={12} />
              Resume
            </>
          ) : (
            <>
              Review
              <ChevronRight size={14} />
            </>
          )}
        </span>
      </div>
    </Link>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "text-cco-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-600";
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case "in_progress":
      return <Pill variant="purple">In Progress</Pill>;
    case "submitted":
      return <Pill variant="green">Completed</Pill>;
    case "timed_out":
      return <Pill>Timed Out</Pill>;
    default:
      return <Pill>{status}</Pill>;
  }
}
