"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Sparkles, X, Check, Send } from "lucide-react";
import { submitQuestionFeedbackAction } from "@/actions/exam";
import {
  FEEDBACK_DIFFICULTIES,
  FEEDBACK_ISSUE_TYPES,
  FEEDBACK_COMMENT_MAX,
} from "@/lib/feedback-options";

interface QuestionFeedbackProps {
  attemptId: number;
  questionPodioId: number;
  /** Question number (1-based) shown in the modal header for context. */
  questionNumber: number;
}

/**
 * CCO-T068: "Share feedback" — a welcoming content-feedback channel distinct
 * from the personal Flag-for-review (transient per-attempt state). Comment +
 * optional "what's this about?" + optional difficulty → a dedicated Podio app
 * Mary/Marlon triage + the Neon `feedback` table. Submitting never touches the
 * exam answer/score state.
 */
export function QuestionFeedback({
  attemptId,
  questionPodioId,
  questionNumber,
}: QuestionFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [issueType, setIssueType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setComment("");
    setDifficulty("");
    setIssueType("");
    setError(null);
    setDone(false);
  }

  function close() {
    setOpen(false);
    // Defer the field reset so it doesn't flash during the close transition.
    setTimeout(reset, 200);
  }

  function submit() {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError("Add a quick note so we know what you mean 🙂");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitQuestionFeedbackAction({
        attemptId,
        questionPodioId,
        comment: trimmed,
        difficulty: difficulty || null,
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-cco-purple/20 bg-cco-purple/[0.07] text-cco-purple transition hover:bg-cco-purple/[0.12] hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
        aria-label="Share feedback on this question"
      >
        <MessageCircle size={14} className="transition group-hover:scale-110" />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md space-y-4 p-6 animate-in fade-in zoom-in-95">
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
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-cco-muted">
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
                  <label className="text-xs font-semibold text-cco-muted">
                    How tough was it?
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-cco-border bg-white px-2.5 py-2 text-sm text-cco-ink font-normal capitalize focus:outline-none focus:border-cco-purple"
                    >
                      <option value="">Optional…</option>
                      {FEEDBACK_DIFFICULTIES.map((d) => (
                        <option key={d} value={d} className="capitalize">
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-semibold text-cco-muted">
                  Tell us more
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
    </>
  );
}
