import Link from "next/link";
import {
  Download,
  RefreshCw,
  Calendar,
  Award,
  Info,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { Pill } from "@/components/shared/Pill";

export interface PastResultRow {
  podioItemId: number;
  appItemId: number | null;
  date: string;          // formatted, e.g. "Mar 25, 2026"
  testName: string;
  scorePercent: number | null;
  passed: boolean | null;
  source: string;        // "Xenforo" | "ProProfs" | "Classmarker" | "CM Dev" | "CCO Portal"
  type: string;          // "CEU" | "Blitz / Practice Exam" | etc — may be empty
  legacyCertUrl: string;
  testItemId: number | null;
  hasCeuCertificate: boolean;  // AAPC PDF template resolved + this row passed CEU
}

export function PastResults({ rows }: { rows: PastResultRow[] }) {
  if (!rows.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-cco-ink">
            Past results
          </h2>
          <p className="text-sm text-cco-muted mt-0.5">
            Tests you took before the new portal — score-only.
          </p>
        </div>
        <span className="text-xs text-cco-muted">
          {rows.length} {rows.length === 1 ? "result" : "results"}
        </span>
      </div>

      <div className="rounded-xl border border-cco-purple/15 bg-cco-purple/5 px-4 py-3 mb-4 flex items-start gap-3 text-sm text-cco-ink/80">
        <Info size={16} className="mt-0.5 shrink-0 text-cco-purple" />
        <p>
          Detailed answer review is only available for tests taken in the new
          portal. Retake an exam to see questions and rationale.
        </p>
      </div>

      {/* --------- MOBILE: cards --------- */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {rows.map((r) => (
          <PastResultCard key={r.podioItemId} row={r} />
        ))}
      </div>

      {/* --------- DESKTOP: table --------- */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-cco-border bg-white shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-cco-bg-soft">
              <Th>Date</Th>
              <Th>Exam</Th>
              <Th>Score</Th>
              <Th>Result</Th>
              <Th>Type</Th>
              <Th>Source</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PastResultRowDesktop key={r.podioItemId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-${align} text-xs font-semibold uppercase tracking-wider text-cco-muted`}
    >
      {children}
    </th>
  );
}

function PastResultRowDesktop({ row }: { row: PastResultRow }) {
  return (
    <tr className="border-t border-cco-border hover:bg-cco-bg-soft transition-colors">
      <td className="px-5 py-3 text-sm text-cco-muted whitespace-nowrap">
        {row.date}
      </td>
      <td className="px-5 py-3 text-sm font-medium text-cco-ink max-w-[28rem]">
        <span className="line-clamp-1" title={row.testName}>
          {row.testName || "Untitled exam"}
        </span>
      </td>
      <td className="px-5 py-3">
        <ScoreCell score={row.scorePercent} />
      </td>
      <td className="px-5 py-3">
        <ResultPill passed={row.passed} score={row.scorePercent} />
      </td>
      <td className="px-5 py-3">
        <TypePill type={row.type} />
      </td>
      <td className="px-5 py-3">
        <SourcePill source={row.source} />
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <RowActions row={row} />
      </td>
    </tr>
  );
}

function PastResultCard({ row }: { row: PastResultRow }) {
  return (
    <div className="bg-white border border-cco-border rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-bold text-cco-ink leading-snug line-clamp-2 mb-1.5">
            {row.testName || "Untitled exam"}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-cco-muted">
            <Calendar size={10} />
            <span>{row.date}</span>
          </div>
        </div>
        <ResultPill passed={row.passed} score={row.scorePercent} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-cco-border">
        <div className="flex items-center gap-3">
          <ScoreCell score={row.scorePercent} />
          <SourcePill source={row.source} />
        </div>
        <RowActions row={row} />
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-sm text-cco-muted">—</span>;
  const tone =
    score >= 80
      ? "text-cco-green-600"
      : score >= 70
        ? "text-amber-600"
        : "text-red-600";
  const bar =
    score >= 80
      ? "bg-cco-green-600"
      : score >= 70
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[86px]">
      <div className="w-12 h-1.5 rounded-full bg-cco-bg-soft overflow-hidden shrink-0">
        <div
          className={`h-full ${bar}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className={`text-sm font-semibold ${tone}`}>
        {Math.round(score)}%
      </span>
    </div>
  );
}

function ResultPill({
  passed,
  score,
}: {
  passed: boolean | null;
  score: number | null;
}) {
  // Defer to derived pass when explicit field is null
  const effective = passed ?? (score != null ? score >= 70 : null);
  if (effective === true)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-cco-green-600">
        <CheckCircle2 size={13} />
        Passed
      </span>
    );
  if (effective === false) return <Pill>Did not pass</Pill>;
  return <Pill>—</Pill>;
}

function TypePill({ type }: { type: string }) {
  if (!type) return <span className="text-xs text-cco-muted">—</span>;
  if (/CEU/i.test(type))
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cco-purple/10 text-cco-purple text-[11px] font-semibold uppercase tracking-wider">
        <Award size={10} />
        CEU
      </span>
    );
  return <Pill>{type}</Pill>;
}

function SourcePill({ source }: { source: string }) {
  if (!source) return <span className="text-xs text-cco-muted">—</span>;
  const isPortal = /CCO Portal/i.test(source);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
        isPortal
          ? "bg-cco-green-600/10 text-cco-green-600"
          : "bg-cco-bg-soft text-cco-muted"
      }`}
    >
      {source}
    </span>
  );
}

function RowActions({ row }: { row: PastResultRow }) {
  const buttons = [];
  // Backfilled AAPC CEU cert (renders Mary's PDF template + name/date overlay)
  if (row.hasCeuCertificate) {
    buttons.push(
      <a
        key="aapc"
        href={`/api/legacy-certificate/${row.podioItemId}`}
        download
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cco-purple/10 text-cco-purple text-xs font-semibold no-underline hover:bg-cco-purple/15"
      >
        <Download size={12} />
        CEU Cert
      </a>
    );
  } else if (row.legacyCertUrl) {
    // Fallback to a legacy URL stored on the original Test Results item
    buttons.push(
      <a
        key="legacy-cert"
        href={row.legacyCertUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cco-purple/10 text-cco-purple text-xs font-semibold no-underline hover:bg-cco-purple/15"
      >
        <Download size={12} />
        Cert
      </a>
    );
  }
  if (row.testItemId) {
    buttons.push(
      <Link
        key="retake"
        href={`/catalog?test=${row.testItemId}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cco-border text-cco-muted text-xs font-semibold no-underline hover:border-cco-purple/40 hover:text-cco-purple"
      >
        <RefreshCw size={12} />
        Retake
      </Link>
    );
  }
  if (!buttons.length) {
    return (
      <span className="text-xs text-cco-muted inline-flex items-center gap-1">
        Score only
        <ArrowUpRight size={10} />
      </span>
    );
  }
  return <div className="inline-flex gap-2">{buttons}</div>;
}
