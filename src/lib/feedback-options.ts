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

export const FEEDBACK_ISSUE_TYPES = [
  { id: "praise", label: "Love this question" },
  { id: "suggestion", label: "Suggestion or idea" },
  { id: "answer_key", label: "Answer key looks off" },
  { id: "unclear", label: "Wording could be clearer" },
  { id: "typo", label: "Typo or formatting" },
  { id: "outdated", label: "Might be outdated" },
  { id: "other", label: "Something else" },
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
