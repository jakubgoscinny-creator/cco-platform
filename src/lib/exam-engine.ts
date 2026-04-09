/**
 * Exam engine types and reducer — pure client-side state management.
 */

export interface QuestionSnapshot {
  podioItemId: number;
  questionText: string;
  options: { key: string; text: string }[];
  correctKey: string;
  rationale: string | null;
}

export interface AnswerState {
  selectedKey: string | null;
  flagged: boolean;
}

export interface ExamState {
  attemptId: number;
  questions: QuestionSnapshot[];
  currentIndex: number;
  answers: Record<number, AnswerState>; // keyed by podioItemId
  timeRemaining: number; // seconds
  status: "active" | "paused" | "submitting" | "submitted";
  scratchPad: string;
  highlights: Record<number, string>; // questionId → highlighted HTML
  paneWidth: number; // 35-70, default 58
}

export type ExamAction =
  | { type: "SELECT_ANSWER"; questionId: number; key: string }
  | { type: "CLEAR_ANSWER"; questionId: number }
  | { type: "FLAG_QUESTION"; questionId: number }
  | { type: "NAVIGATE"; index: number }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "TICK" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SUBMIT" }
  | { type: "SUBMITTED" }
  | { type: "UPDATE_SCRATCH_PAD"; content: string }
  | { type: "SET_HIGHLIGHT"; questionId: number; html: string }
  | { type: "CLEAR_HIGHLIGHT"; questionId: number }
  | { type: "SET_PANE_WIDTH"; width: number };

export function examReducer(state: ExamState, action: ExamAction): ExamState {
  switch (action.type) {
    case "SELECT_ANSWER":
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: {
            ...state.answers[action.questionId],
            selectedKey: action.key,
          },
        },
      };

    case "CLEAR_ANSWER":
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: {
            ...state.answers[action.questionId],
            selectedKey: null,
          },
        },
      };

    case "FLAG_QUESTION":
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: {
            ...state.answers[action.questionId],
            flagged: !state.answers[action.questionId]?.flagged,
          },
        },
      };

    case "NAVIGATE":
      return {
        ...state,
        currentIndex: Math.max(
          0,
          Math.min(action.index, state.questions.length - 1)
        ),
      };

    case "NEXT":
      return {
        ...state,
        currentIndex: Math.min(
          state.currentIndex + 1,
          state.questions.length - 1
        ),
      };

    case "PREV":
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };

    case "TICK":
      if (state.status !== "active") return state;
      return {
        ...state,
        timeRemaining: Math.max(state.timeRemaining - 1, 0),
      };

    case "PAUSE":
      return { ...state, status: "paused" };

    case "RESUME":
      return { ...state, status: "active" };

    case "SUBMIT":
      return { ...state, status: "submitting" };

    case "SUBMITTED":
      return { ...state, status: "submitted" };

    case "UPDATE_SCRATCH_PAD":
      return { ...state, scratchPad: action.content };

    case "SET_HIGHLIGHT": {
      const next = { ...state.highlights };
      next[action.questionId] = action.html;
      return { ...state, highlights: next };
    }

    case "CLEAR_HIGHLIGHT": {
      const next = { ...state.highlights };
      delete next[action.questionId];
      return { ...state, highlights: next };
    }

    case "SET_PANE_WIDTH":
      return {
        ...state,
        paneWidth: Math.max(35, Math.min(70, action.width)),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAnsweredCount(state: ExamState): number {
  return Object.values(state.answers).filter((a) => a.selectedKey !== null)
    .length;
}

export function getFlaggedCount(state: ExamState): number {
  return Object.values(state.answers).filter((a) => a.flagged).length;
}

export function getSkippedCount(state: ExamState): number {
  return state.questions.length - getAnsweredCount(state);
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
