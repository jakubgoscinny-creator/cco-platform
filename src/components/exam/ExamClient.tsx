"use client";

import { useReducer, useEffect, useRef, useCallback, useState } from "react";
import {
  examReducer,
  formatTime,
  getAnsweredCount,
  getFlaggedCount,
  getSkippedCount,
  type ExamState,
  type QuestionSnapshot,
  type AnswerState,
} from "@/lib/exam-engine";
import { saveAnswerAction, saveExamStateAction, submitExamAction } from "@/actions/exam";
import { QuestionGrid } from "./QuestionGrid";
import { ScratchPad } from "./ScratchPad";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  Send,
  Pause,
  Play,
  StickyNote,
  AlertTriangle,
} from "lucide-react";

interface ExamClientProps {
  attemptId: number;
  testName: string;
  questions: QuestionSnapshot[];
  initialAnswers: Record<number, AnswerState>;
  initialTimeRemaining: number;
  initialScratchPad: string;
}

export function ExamClient({
  attemptId,
  testName,
  questions,
  initialAnswers,
  initialTimeRemaining,
  initialScratchPad,
}: ExamClientProps) {
  const initialState: ExamState = {
    attemptId,
    questions,
    currentIndex: 0,
    answers: initialAnswers,
    timeRemaining: initialTimeRemaining,
    status: "active",
    scratchPad: initialScratchPad,
  };

  const [state, dispatch] = useReducer(examReducer, initialState);
  const [showGrid, setShowGrid] = useState(false);
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = state.questions[state.currentIndex];
  const currentAnswer = currentQuestion
    ? state.answers[currentQuestion.podioItemId]
    : null;

  // Timer
  useEffect(() => {
    if (state.status !== "active") return;
    const interval = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(interval);
  }, [state.status]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (state.timeRemaining <= 0 && state.status === "active") {
      handleSubmit();
    }
  }, [state.timeRemaining, state.status]);

  // Persist timer + scratch pad every 30 seconds
  useEffect(() => {
    if (state.status !== "active") return;
    const interval = setInterval(() => {
      saveExamStateAction(attemptId, state.timeRemaining, state.scratchPad);
    }, 30000);
    return () => clearInterval(interval);
  }, [attemptId, state.timeRemaining, state.scratchPad, state.status]);

  // Save answer with debounce
  const saveAnswer = useCallback(
    (questionId: number, selectedKey: string | null, flagged: boolean) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveAnswerAction(attemptId, questionId, selectedKey, flagged);
      }, 500);
    },
    [attemptId]
  );

  function handleSelectAnswer(key: string) {
    if (!currentQuestion || state.status !== "active") return;
    const qId = currentQuestion.podioItemId;
    const currentKey = state.answers[qId]?.selectedKey;
    const flagged = state.answers[qId]?.flagged ?? false;

    if (currentKey === key) {
      dispatch({ type: "CLEAR_ANSWER", questionId: qId });
      saveAnswer(qId, null, flagged);
    } else {
      dispatch({ type: "SELECT_ANSWER", questionId: qId, key });
      saveAnswer(qId, key, flagged);
    }
  }

  function handleFlag() {
    if (!currentQuestion || state.status !== "active") return;
    const qId = currentQuestion.podioItemId;
    dispatch({ type: "FLAG_QUESTION", questionId: qId });
    const newFlagged = !state.answers[qId]?.flagged;
    const selectedKey = state.answers[qId]?.selectedKey ?? null;
    saveAnswer(qId, selectedKey, newFlagged);
  }

  async function handleSubmit() {
    dispatch({ type: "SUBMIT" });
    await saveExamStateAction(attemptId, state.timeRemaining, state.scratchPad);
    await submitExamAction(attemptId);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (state.status !== "active") return;
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "ArrowRight":
          dispatch({ type: "NEXT" });
          break;
        case "ArrowLeft":
          dispatch({ type: "PREV" });
          break;
        case "a":
        case "A":
        case "1":
          handleSelectAnswer("A");
          break;
        case "b":
        case "B":
        case "2":
          handleSelectAnswer("B");
          break;
        case "c":
        case "C":
        case "3":
          handleSelectAnswer("C");
          break;
        case "d":
        case "D":
        case "4":
          handleSelectAnswer("D");
          break;
        case "f":
        case "F":
          handleFlag();
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.status, state.currentIndex, state.answers]);

  const isLowTime = state.timeRemaining < 300; // < 5 min
  const isSubmitting = state.status === "submitting";

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-cco-border shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-heading font-semibold text-sm text-cco-ink truncate max-w-[200px] sm:max-w-none">
            {testName}
          </h2>
          <span className="text-xs text-cco-muted">
            {state.currentIndex + 1} / {state.questions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-semibold ${
              isLowTime
                ? "bg-red-50 text-red-700 animate-pulse"
                : "bg-cco-bg-soft text-cco-ink"
            }`}
          >
            <Clock size={14} />
            {formatTime(state.timeRemaining)}
          </div>

          <button
            onClick={() => dispatch({ type: state.status === "paused" ? "RESUME" : "PAUSE" })}
            className="p-2 rounded-full text-cco-muted hover:bg-cco-bg-soft transition"
            title={state.status === "paused" ? "Resume" : "Pause"}
          >
            {state.status === "paused" ? <Play size={16} /> : <Pause size={16} />}
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              showGrid
                ? "bg-cco-purple text-white"
                : "bg-white border border-cco-border text-cco-muted hover:bg-cco-bg-soft"
            }`}
          >
            Grid
          </button>

          <button
            onClick={() => setShowScratchPad(!showScratchPad)}
            className={`p-2 rounded-full transition ${
              showScratchPad
                ? "bg-cco-purple text-white"
                : "text-cco-muted hover:bg-cco-bg-soft"
            }`}
            title="Scratch pad"
          >
            <StickyNote size={16} />
          </button>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cco-green text-white text-xs font-semibold transition hover:bg-cco-green-600 disabled:opacity-50"
          >
            <Send size={12} />
            Submit
          </button>
        </div>
      </div>

      {/* Paused overlay */}
      {state.status === "paused" && (
        <div className="absolute inset-0 z-30 bg-white/95 flex items-center justify-center">
          <div className="text-center">
            <Pause size={48} className="text-cco-muted mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold text-cco-ink mb-2">
              Exam Paused
            </h2>
            <p className="text-cco-muted mb-4">
              Time remaining: {formatTime(state.timeRemaining)}
            </p>
            <button
              onClick={() => dispatch({ type: "RESUME" })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cco-purple text-white font-semibold transition hover:bg-cco-purple-600"
            >
              <Play size={18} />
              Resume Exam
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentQuestion && (
            <div className="max-w-3xl mx-auto">
              {/* Question text */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cco-purple text-white text-sm font-bold">
                    {state.currentIndex + 1}
                  </span>
                  {currentAnswer?.flagged && (
                    <Flag size={16} className="text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div
                  className="text-cco-ink leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentAnswer?.selectedKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectAnswer(opt.key)}
                      disabled={state.status !== "active"}
                      className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border-2 transition ${
                        isSelected
                          ? "border-cco-purple bg-[rgba(129,84,129,0.08)]"
                          : "border-cco-border hover:border-cco-purple/40 hover:bg-cco-bg-soft"
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                          isSelected
                            ? "bg-cco-purple text-white"
                            : "bg-cco-bg-soft text-cco-muted"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm text-cco-ink pt-0.5">{stripHtml(opt.text)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation + flag */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-cco-border">
                <button
                  onClick={() => dispatch({ type: "PREV" })}
                  disabled={state.currentIndex === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-cco-muted hover:bg-cco-bg-soft transition disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <button
                  onClick={handleFlag}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    currentAnswer?.flagged
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-cco-border text-cco-muted hover:border-amber-400 hover:bg-amber-50"
                  }`}
                >
                  <Flag size={12} />
                  {currentAnswer?.flagged ? "Flagged" : "Flag for review"}
                </button>

                <button
                  onClick={() => dispatch({ type: "NEXT" })}
                  disabled={state.currentIndex === state.questions.length - 1}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-cco-purple text-white hover:bg-cco-purple-600 transition disabled:opacity-30"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Keyboard hints */}
              <p className="text-center text-xs text-cco-muted mt-4">
                Keyboard: A-D to answer, F to flag, arrows to navigate
              </p>
            </div>
          )}
        </div>

        {/* Question grid sidebar */}
        {showGrid && (
          <div className="w-64 border-l border-cco-border bg-white overflow-y-auto p-4 shrink-0">
            <QuestionGrid
              questions={state.questions}
              answers={state.answers}
              currentIndex={state.currentIndex}
              onNavigate={(i) => dispatch({ type: "NAVIGATE", index: i })}
            />
            <div className="mt-4 space-y-1 text-xs text-cco-muted">
              <p>Answered: {getAnsweredCount(state)}/{state.questions.length}</p>
              <p>Flagged: {getFlaggedCount(state)}</p>
              <p>Skipped: {getSkippedCount(state)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Scratch pad */}
      {showScratchPad && (
        <ScratchPad
          value={state.scratchPad}
          onChange={(content) =>
            dispatch({ type: "UPDATE_SCRATCH_PAD", content })
          }
          onClose={() => setShowScratchPad(false)}
        />
      )}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={20} />
              <h3 className="font-heading font-bold text-lg">Submit Exam?</h3>
            </div>
            <div className="text-sm text-cco-muted space-y-1">
              <p>Answered: {getAnsweredCount(state)} / {state.questions.length}</p>
              <p>Flagged: {getFlaggedCount(state)}</p>
              <p>Unanswered: {getSkippedCount(state)}</p>
              <p>Time remaining: {formatTime(state.timeRemaining)}</p>
            </div>
            {getSkippedCount(state) > 0 && (
              <p className="text-sm text-amber-600 font-medium">
                You have {getSkippedCount(state)} unanswered question{getSkippedCount(state) !== 1 ? "s" : ""}.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-full border border-cco-border text-cco-muted font-semibold text-sm transition hover:bg-cco-bg-soft"
              >
                Continue Exam
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmit();
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-full bg-cco-green text-white font-semibold text-sm transition hover:bg-cco-green-600 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    .replace(/\s+/g, " ")
    .trim();
}
