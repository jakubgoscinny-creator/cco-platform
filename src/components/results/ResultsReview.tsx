"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, MinusCircle, Flag } from "lucide-react";

export interface ResultQuestion {
  podioItemId: number;
  questionText: string;
  options: Array<{ key: string; text: string }>;
  correctKey: string;
  rationale: string | null;
  selectedKey: string | null;
  isCorrect: boolean | null;
  flagged: boolean;
}

interface ResultsReviewProps {
  questions: ResultQuestion[];
  scratchPad: string | null;
}

export function ResultsReview({ questions, scratchPad }: ResultsReviewProps) {
  const [index, setIndex] = useState(0);
  const current = questions[index];

  if (!current) {
    return (
      <div className="text-sm text-cco-muted p-6 text-center">
        No questions to review.
      </div>
    );
  }

  const currentIsSkipped = current.selectedKey == null;
  const currentIsCorrect = !currentIsSkipped && current.isCorrect === true;
  const currentIsIncorrect = !currentIsSkipped && current.isCorrect === false;

  return (
    <div className="grid gap-4 lg:grid-cols-[72px_1fr_280px]">
      {/* LEFT (or TOP on mobile) — question navigator */}
      <nav
        aria-label="Jump to question"
        className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x lg:snap-none scrollbar-thin"
      >
        {questions.map((q, i) => {
          const isCurrent = i === index;
          // CRITICAL ORDER: check skipped first. Historical data stores
          // isCorrect=false for null selectedKey, so isIncorrect would
          // wrongly match for skipped answers.
          const isSkipped = q.selectedKey == null;
          const isCorrect = !isSkipped && q.isCorrect === true;
          const isIncorrect = !isSkipped && q.isCorrect === false;

          const base =
            "shrink-0 snap-start w-12 sm:w-14 lg:w-full py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition relative";

          let state =
            "bg-white border border-cco-border text-cco-muted hover:border-cco-purple/40";
          if (isSkipped)
            state =
              "bg-cco-bg-soft border border-dashed border-cco-border text-cco-muted";
          else if (isCorrect)
            state =
              "bg-cco-green/10 border border-cco-green/40 text-cco-green-600";
          else if (isIncorrect)
            state = "bg-red-50 border border-red-200 text-red-600";
          if (isCurrent)
            state =
              state + " ring-2 ring-cco-purple ring-offset-2 ring-offset-cco-bg";

          const label = isSkipped
            ? `Q${i + 1} — Skipped`
            : isCorrect
              ? `Q${i + 1} — Correct`
              : `Q${i + 1} — Incorrect`;

          return (
            <button
              key={q.podioItemId}
              onClick={() => setIndex(i)}
              className={`${base} ${state}`}
              title={label}
              aria-label={label}
            >
              Q{i + 1}
              {q.flagged && (
                <Flag
                  size={9}
                  className="absolute top-1 right-1 text-amber-500 fill-amber-500"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* CENTER — current question detail */}
      <div className="bg-white border border-cco-border rounded-2xl p-4 sm:p-6 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-cco-purple text-white text-sm font-bold">
              {index + 1}
            </span>
            <h3 className="font-heading font-bold text-cco-ink">
              Question {index + 1} of {questions.length}
            </h3>
          </div>
          <ResultBadge
            isCorrect={currentIsCorrect}
            isIncorrect={currentIsIncorrect}
            isSkipped={currentIsSkipped}
          />
        </div>

        <div
          className="text-[15px] text-cco-ink leading-relaxed prose prose-sm max-w-none mb-5"
          dangerouslySetInnerHTML={{ __html: current.questionText }}
        />

        {/* Options with correct/incorrect highlighting */}
        <div className="space-y-2 mb-5">
          {current.options.map((opt) => {
            const isSelected = current.selectedKey === opt.key;
            const isCorrectOption = opt.key === current.correctKey;

            let cls = "border-cco-border bg-white";
            let badge = "bg-cco-bg-soft text-cco-muted";
            if (isCorrectOption) {
              cls = "border-cco-green/50 bg-cco-green/5";
              badge = "bg-cco-green text-white";
            } else if (isSelected) {
              cls = "border-red-300 bg-red-50";
              badge = "bg-red-400 text-white";
            }

            return (
              <div
                key={opt.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 ${cls}`}
              >
                <span
                  className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${badge}`}
                >
                  {opt.key}
                </span>
                <span className="text-sm text-cco-ink pt-0.5 flex-1">
                  {stripHtml(opt.text)}
                </span>
                {isCorrectOption && (
                  <CheckCircle
                    size={16}
                    className="text-cco-green-600 shrink-0 mt-1"
                  />
                )}
                {isSelected && !isCorrectOption && (
                  <XCircle
                    size={16}
                    className="text-red-500 shrink-0 mt-1"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Answer summary — explicit labels so it's easy to scan */}
        <div className="bg-cco-bg-soft rounded-xl p-4 text-sm space-y-1.5 mb-4">
          <p>
            <span className="font-semibold text-cco-ink">Your answer:</span>{" "}
            <span className="text-cco-muted">
              {current.selectedKey
                ? `${current.selectedKey}) ${stripHtml(
                    current.options.find((o) => o.key === current.selectedKey)
                      ?.text ?? ""
                  )}`
                : "No answer"}
            </span>
          </p>
          <p>
            <span className="font-semibold text-cco-ink">Correct answer:</span>{" "}
            <span className="text-cco-green-600 font-medium">
              {current.correctKey}){" "}
              {stripHtml(
                current.options.find((o) => o.key === current.correctKey)
                  ?.text ?? ""
              )}
            </span>
          </p>
        </div>

        {/* Rationale */}
        {current.rationale ? (
          <div className="rounded-xl p-4 border border-[#fcb900]/30 bg-[#fcb900]/5">
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#a37400] mb-2">
              Rationale
            </p>
            <div
              className="text-sm text-cco-ink prose prose-sm max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: current.rationale }}
            />
          </div>
        ) : (
          <p className="text-xs text-cco-muted italic">
            No rationale available for this question.
          </p>
        )}

        {/* Nav */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-cco-border">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-cco-muted hover:bg-cco-bg-soft transition disabled:opacity-30"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span className="text-xs text-cco-muted">
            {index + 1} / {questions.length}
          </span>
          <button
            onClick={() =>
              setIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            disabled={index === questions.length - 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-cco-purple text-white hover:bg-cco-purple-600 transition disabled:opacity-30"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* RIGHT — scratch pad (read-only) */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white border border-cco-border rounded-2xl p-4">
          <h4 className="font-heading font-bold text-sm text-cco-ink mb-2">
            Your scratch pad
          </h4>
          {scratchPad ? (
            <pre className="text-xs text-cco-ink bg-cco-bg-soft rounded-lg p-3 whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-sans">
              {scratchPad}
            </pre>
          ) : (
            <p className="text-xs text-cco-muted italic">
              You didn&rsquo;t take any notes during this exam.
            </p>
          )}
        </div>
        <Legend />
      </aside>
    </div>
  );
}

function ResultBadge({
  isCorrect,
  isIncorrect,
  isSkipped,
}: {
  isCorrect: boolean;
  isIncorrect: boolean;
  isSkipped: boolean;
}) {
  if (isCorrect)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cco-green/10 text-cco-green-600 border border-cco-green/30">
        <CheckCircle size={12} /> Correct
      </span>
    );
  if (isIncorrect)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
        <XCircle size={12} /> Incorrect
      </span>
    );
  if (isSkipped)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cco-bg-soft text-cco-muted border border-cco-border">
        <MinusCircle size={12} /> Skipped
      </span>
    );
  return null;
}

function Legend() {
  return (
    <div className="bg-white border border-cco-border rounded-2xl p-4">
      <h4 className="font-heading font-bold text-sm text-cco-ink mb-3">
        Legend
      </h4>
      <div className="space-y-2 text-xs text-cco-muted">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-cco-green/10 border border-cco-green/40" />
          Correct
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-red-50 border border-red-200" />
          Incorrect
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-md bg-cco-bg-soft border border-dashed border-cco-border" />
          Skipped
        </div>
        <div className="flex items-center gap-2">
          <Flag size={10} className="text-amber-500 fill-amber-500" />
          Flagged for review
        </div>
      </div>
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
