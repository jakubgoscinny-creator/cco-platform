import Link from "next/link";
import { Lock, ArrowRight, FileText, Clock } from "lucide-react";
import type { TestCardProps } from "./TestCard";

/**
 * Compact catalog row used inside a collapsed course/section folder
 * (CatalogGroups). Far lighter than the full TestCard — designed so a folder
 * of 27 chapter exams reads as a tidy list, not a wall of cards.
 */
export function TestRow({ test }: { test: TestCardProps }) {
  const { id, name, questionCount, timeLimitMinutes, locked } = test;
  return (
    <div className="flex items-center gap-3 py-2.5 pl-2.5 pr-1.5 rounded-xl transition-colors hover:bg-cco-bg-soft">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-cco-ink">{name}</p>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-cco-muted">
          {questionCount != null && (
            <span className="inline-flex items-center gap-1">
              <FileText size={12} />
              {questionCount} questions
            </span>
          )}
          {timeLimitMinutes != null && timeLimitMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {timeLimitMinutes} min
            </span>
          )}
        </p>
      </div>

      {locked ? (
        <a
          href="https://cco.us/club#price"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-cco-gold/15 px-3 py-1.5 text-xs font-semibold text-cco-gold-dark no-underline transition hover:bg-cco-gold/25"
        >
          <Lock size={13} />
          Join CCO Club
        </a>
      ) : (
        <Link
          href={`/exam/start?test_id=${id}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-cco-purple px-4 py-1.5 text-xs font-semibold text-white no-underline transition hover:-translate-y-px hover:bg-cco-purple-600 hover:shadow-md"
        >
          Start
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
