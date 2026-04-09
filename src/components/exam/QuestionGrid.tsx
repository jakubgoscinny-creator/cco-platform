import type { QuestionSnapshot, AnswerState } from "@/lib/exam-engine";

interface QuestionGridProps {
  questions: QuestionSnapshot[];
  answers: Record<number, AnswerState>;
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function QuestionGrid({
  questions,
  answers,
  currentIndex,
  onNavigate,
}: QuestionGridProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-cco-muted mb-3">
        Questions
      </h3>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const answer = answers[q.podioItemId];
          const isCurrent = i === currentIndex;
          const isAnswered = answer?.selectedKey != null;
          const isFlagged = answer?.flagged;

          let bg = "bg-cco-bg-soft text-cco-muted";
          if (isAnswered) bg = "bg-cco-green/20 text-cco-green-600";
          if (isFlagged) bg = "bg-amber-100 text-amber-700";
          if (isCurrent) bg += " ring-2 ring-cco-purple";

          return (
            <button
              key={q.podioItemId}
              onClick={() => onNavigate(i)}
              className={`w-full aspect-square rounded-lg text-xs font-bold transition hover:opacity-80 ${bg}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-cco-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-cco-bg-soft border border-cco-border" />
          Unanswered
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-cco-green/20" />
          Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-100" />
          Flagged
        </span>
      </div>
    </div>
  );
}
