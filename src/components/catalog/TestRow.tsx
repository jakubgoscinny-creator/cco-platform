import Link from "next/link";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import type { TestCardProps } from "./TestCard";
import { CLUB_URL } from "@/lib/course-links";

/** Shorten "PBC Chapter 03 Exam" -> "Chapter 03" so a grid of chapter cells
 *  reads cleanly. Non-chapter exams (CEUs) keep their full name. */
function shortLabel(name: string): string {
  const m = name.match(/\b(Chapter\s+\d+[A-Za-z.]*|Mid-?term|Final)\b/i);
  return m ? m[1].replace(/\s+/g, " ") : name;
}

/**
 * A compact exam CELL inside a course/section folder grid (CatalogGroups). Shows
 * the student's status — passed (green ✓ + score), attempted (score, retry), or
 * not started — so a 27-chapter course reads as a progress board, not a scroll.
 */
export function TestRow({ test }: { test: TestCardProps }) {
  const { id, name, questionCount, locked, unlockUrl, passed, attempted, scorePercent } = test;
  const done = passed === true;
  const score = scorePercent != null ? Math.round(scorePercent) : null;
  const label = shortLabel(name);

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-xl border p-3 transition ${
        done
          ? "border-cco-green/40 bg-cco-green/5"
          : "border-cco-border bg-cco-card hover:border-cco-purple/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-cco-ink" title={name}>
            {label}
          </p>
          {questionCount != null && (
            <p className="mt-0.5 text-xs text-cco-muted">{questionCount} questions</p>
          )}
        </div>
        {done && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cco-green-600" />}
      </div>

      <div className="flex items-center justify-between gap-2">
        {done ? (
          <span className="text-xs font-bold text-cco-green-600">
            Passed{score != null ? ` · ${score}%` : ""}
          </span>
        ) : attempted ? (
          <span className="text-xs font-semibold text-cco-gold-dark">
            {score != null ? `Scored ${score}%` : "Attempted"}
          </span>
        ) : (
          <span className="text-xs text-cco-muted">Not started</span>
        )}

        {locked ? (
          <a
            href={unlockUrl ?? CLUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-cco-gold/15 px-3 py-1 text-xs font-semibold text-cco-gold-dark no-underline transition hover:bg-cco-gold/25"
          >
            <Lock size={12} />
            Unlock
          </a>
        ) : (
          <Link
            href={`/exam/start?test_id=${id}`}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-semibold no-underline transition hover:-translate-y-px hover:shadow-md ${
              done
                ? "bg-white text-cco-purple ring-1 ring-cco-purple/30 hover:bg-cco-bg-soft"
                : "bg-cco-purple text-white hover:bg-cco-purple-600"
            }`}
          >
            {done ? "Retake" : attempted ? "Retry" : "Start"}
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}
