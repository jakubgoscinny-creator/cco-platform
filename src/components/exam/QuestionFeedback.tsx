"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Sparkles, X, Check, Send } from "lucide-react";
import { submitQuestionFeedbackAction } from "@/actions/exam";
import {
  FEEDBACK_DIFFICULTIES,
  FEEDBACK_ISSUE_TYPES,
  FEEDBACK_COMMENT_MAX,
  feedbackIssueRequiresComment,
  type FeedbackDifficulty,
} from "@/lib/feedback-options";

interface QuestionFeedbackProps {
  attemptId: number;
  questionPodioId: number;
  /** Question number (1-based) shown in the modal header for context. */
  questionNumber: number;
}

// CCO-T081: one-tap difficulty labels. Colour-coded so a rating reads at a
// glance; keyed off FEEDBACK_DIFFICULTIES so the vocabulary can't drift.
const DIFFICULTY_UI: Record<
  FeedbackDifficulty,
  { label: string; idle: string; active: string }
> = {
  easy: {
    label: "Easy",
    idle: "border-cco-green/30 text-cco-green-600 hover:bg-cco-green/10",
    active: "border-cco-green bg-cco-green/15 text-cco-green-600 shadow-sm",
  },
  medium: {
    label: "Medium",
    idle: "border-cco-gold/40 text-cco-gold-dark hover:bg-cco-gold/10",
    active: "border-cco-gold bg-cco-gold/20 text-cco-gold-dark shadow-sm",
  },
  hard: {
    label: "Hard",
    idle: "border-cco-purple/25 text-cco-purple hover:bg-cco-purple/10",
    active: "border-cco-purple bg-cco-purple/15 text-cco-purple shadow-sm",
  },
};

/**
 * CCO-T068 / CCO-T081: per-question feedback — a welcoming content-feedback
 * channel distinct from the personal Flag-for-review (transient per-attempt
 * state). Two paths, both hitting the same ownership-guarded
 * submitQuestionFeedbackAction → dedicated Podio app + Neon `feedback` table:
 *
 *   1. A one-tap difficulty rating (Easy / Medium / Hard) — submits instantly,
 *      no comment prompt (CCO-T081).
 *   2. A "Share feedback" modal for detail — an optional topic + a comment that
 *      is only required for topics that need it (a problem report), not for a
 *      quick "Love this question".
 *
 * Rendered both live (ExamClient) and when reviewing a past attempt
 * (ResultsReview). Submitting never touches exam answer/score state.
 */
export function QuestionFeedback({
  attemptId,
  questionPodioId,
  questionNumber,
}: QuestionFeedbackProps) {
  // Quick difficulty-rating state (inline, no modal).
  const [rating, setRating] = useState<FeedbackDifficulty | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isRating, startRating] = useTransition();

  // Detailed-feedback modal state.
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [issueType, setIssueType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function quickRate(difficulty: FeedbackDifficulty) {
    if (isRating) return;
    setRatingError(null);
    startRating(async () => {
      const result = await submitQuestionFeedbackAction({
        attemptId,
        questionPodioId,
        comment: "",
        difficulty,
      });
      if (result && "error" in result) {
        setRatingError(result.error);
        return;
      }
      setRating(difficulty);
    });
  }

  function resetModal() {
    setComment("");
    setIssueType("");
    setError(null);
    setDone(false);
  }

  function close() {
    setOpen(false);
    // Defer the field reset so it doesn't flash during the close transition.
    setTimeout(resetModal, 200);
  }

  function submit() {
    const trimmed = comment.trim();
    // CCO-T081: only topics that need detail force a comment; a quick positive
    // tap ("Love this question") can go through on its own.
    if (feedbackIssueRequiresComment(issueType) && !trimmed) {
      setError("Add a quick note so we know what you mean 🙂");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitQuestionFeedbackAction({
        attemptId,
        questionPodioId,
        comment: trimmed,
        issueType: issueType || null,
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
      setTimeout(close, 1500);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {/* One-tap difficulty rating (CCO-T081) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-cco-muted font-semibold">
            {rating ? "Thanks!" : "How hard?"}
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="Rate this question's difficulty">
            {FEEDBACK_DIFFICULTIES.map((d) => {
              const ui = DIFFICULTY_UI[d];
              const isActive = rating === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => quickRate(d)}
                  disabled={isRating}
                  aria-pressed={isActive}
                  aria-label={`Rate ${ui.label}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition active:scale-95 disabled:opacity-50 ${
                    isActive ? ui.active : ui.idle
                  }`}
                >
                  {ui.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed-feedback pill → modal */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-cco-purple/20 bg-cco-purple/[0.07] text-cco-purple transition hover:bg-cco-purple/[0.12] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
          aria-label="Share detailed feedback on this question"
        >
          <MessageCircle size={14} className="transition group-hover:scale-110" />
          Feedback
        </button>
      </div>

      {/* Inline confirmation / error for the quick rating */}
      {rating && !ratingError && (
        <p className="text-[11px] font-medium text-cco-green-600">
          Difficulty noted — thank you! 💜
        </p>
      )}
      {ratingError && (
        <p className="text-[11px] font-medium text-red-600">{ratingError}</p>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6 animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cco-purple/15 to-cco-green/15 text-cco-purple">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h3 className="font-heading font-bold text-lg text-cco-ink leading-tight">
                    Share feedback
                  </h3>
                  <p className="text-xs text-cco-muted">
                    Question {questionNumber} · helps us make it better
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="p-1 rounded-full text-cco-muted hover:bg-cco-bg-soft transition"
              >
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-cco-green/10 px-4 py-5 text-cco-green-600">
                <Check size={18} />
                <p className="text-sm font-semibold">
                  Thanks — that&apos;s a real help to the CCO team! 💜
                </p>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-cco-muted">
                  What&apos;s this about?
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-cco-border bg-white px-2.5 py-2 text-sm text-cco-ink font-normal focus:outline-none focus:border-cco-purple"
                  >
                    <option value="">Choose…</option>
                    {FEEDBACK_ISSUE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold text-cco-muted">
                  Tell us more
                  {!feedbackIssueRequiresComment(issueType) && (
                    <span className="ml-1 font-normal text-cco-muted/80">
                      (optional)
                    </span>
                  )}
                  <textarea
                    value={comment}
                    onChange={(e) =>
                      setComment(e.target.value.slice(0, FEEDBACK_COMMENT_MAX))
                    }
                    rows={4}
                    autoFocus
                    placeholder="What did you notice? A suggestion, something unclear, a possible answer-key issue — or just that you liked it."
                    className="mt-1 w-full rounded-lg border border-cco-border bg-white px-3 py-2 text-sm text-cco-ink font-normal resize-none focus:outline-none focus:border-cco-purple"
                  />
                  <span className="mt-0.5 block text-right text-[10px] font-normal text-cco-muted">
                    {comment.length}/{FEEDBACK_COMMENT_MAX}
                  </span>
                </label>

                {error && (
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={close}
                    className="flex-1 px-4 py-2.5 rounded-full border border-cco-border text-cco-muted font-semibold text-sm transition hover:bg-cco-bg-soft"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-cco-purple text-white font-semibold text-sm transition hover:bg-cco-purple-600 disabled:opacity-50"
                  >
                    {isPending ? (
                      "Sending…"
                    ) : (
                      <>
                        <Send size={14} />
                        Send feedback
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
