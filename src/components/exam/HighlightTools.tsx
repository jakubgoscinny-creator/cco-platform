"use client";

import { useCallback, useRef } from "react";
import { Highlighter, Eraser } from "lucide-react";

interface HighlightToolsProps {
  questionId: number;
  onHighlight: (questionId: number, html: string) => void;
  onClear: (questionId: number) => void;
  hasHighlights: boolean;
}

export function HighlightTools({
  questionId,
  onHighlight,
  onClear,
  hasHighlights,
}: HighlightToolsProps) {
  const questionTextRef = useRef<HTMLElement | null>(null);

  const handleHighlight = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    // Find the question text container
    const container = document.getElementById(
      `tp-question-text-${questionId}`
    );
    if (!container) return;
    if (!container.contains(range.commonAncestorContainer)) return;

    const mark = document.createElement("mark");
    mark.className = "tp-inline-highlight";
    mark.style.background = "#fff2a8";
    mark.style.color = "inherit";
    mark.style.borderRadius = "0.15em";
    mark.style.padding = "0 0.08em";

    try {
      range.surroundContents(mark);
    } catch {
      // Fallback for cross-element selections
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }

    selection.removeAllRanges();
    onHighlight(questionId, container.innerHTML);
  }, [questionId, onHighlight]);

  const handleClear = useCallback(() => {
    onClear(questionId);
  }, [questionId, onClear]);

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={handleHighlight}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-cco-border text-cco-muted hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition"
      >
        <Highlighter size={12} />
        Highlight selection
      </button>
      {hasHighlights && (
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-cco-border text-cco-muted hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition"
        >
          <Eraser size={12} />
          Clear highlights
        </button>
      )}
    </div>
  );
}
