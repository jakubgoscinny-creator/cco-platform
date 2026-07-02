/**
 * CCO-T068: single source of truth for the per-question feedback vocabulary.
 *
 * Shared by the feedback modal (UI), `submitQuestionFeedbackAction`
 * (server-side validation), and the dedicated "CCO Question Feedback" Podio app
 * (its category options) so the three can never drift.
 *
 * Tone is deliberately welcoming (it's "Share feedback", not "report a problem")
 * — positive/constructive options first, with the problem categories framed
 * softly.
 */

export const FEEDBACK_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type FeedbackDifficulty = (typeof FEEDBACK_DIFFICULTIES)[number];

// CCO-T081: `requiresComment` marks the types that only make sense WITH detail
// ("flag as wrong", a typo, etc.) so the UI can prompt for a comment on those
// while letting a quick positive tap ("Love this question") — and the one-tap
// difficulty rating — go through with no comment.
export const FEEDBACK_ISSUE_TYPES = [
  { id: "praise", label: "Love this question", requiresComment: false },
  { id: "suggestion", label: "Suggestion or idea", requiresComment: true },
  { id: "answer_key", label: "Answer key looks off", requiresComment: true },
  { id: "unclear", label: "Wording could be clearer", requiresComment: true },
  { id: "typo", label: "Typo or formatting", requiresComment: true },
  { id: "outdated", label: "Might be outdated", requiresComment: true },
  { id: "other", label: "Something else", requiresComment: true },
] as const;
export type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number]["id"];

/** Max accepted comment length (server-enforced; UI shows a counter). */
export const FEEDBACK_COMMENT_MAX = 4000;

export function isFeedbackDifficulty(v: unknown): v is FeedbackDifficulty {
  return typeof v === "string" && (FEEDBACK_DIFFICULTIES as readonly string[]).includes(v);
}

export function isFeedbackIssueType(v: unknown): v is FeedbackIssueType {
  return (
    typeof v === "string" &&
    FEEDBACK_ISSUE_TYPES.some((t) => t.id === v)
  );
}

export function feedbackIssueLabel(id: string): string {
  return FEEDBACK_ISSUE_TYPES.find((t) => t.id === id)?.label ?? id;
}

/**
 * CCO-T081: does this issue type need a written comment to be useful? Unknown
 * or unset ids default to `true` (safe — the detailed modal still asks for a
 * note unless the chosen type is an explicit no-detail one like praise).
 */
export function feedbackIssueRequiresComment(id: string | null | undefined): boolean {
  const t = FEEDBACK_ISSUE_TYPES.find((t) => t.id === id);
  return t ? t.requiresComment : true;
}
