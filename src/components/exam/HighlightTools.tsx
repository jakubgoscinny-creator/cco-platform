"use client";

import { useCallback } from "react";
import { Eraser } from "lucide-react";

interface HighlightToolsProps {
  questionId: number;
  onHighlight: (questionId: number, html: string) => void;
  onClear: (questionId: number) => void;
  hasHighlights: boolean;
}

// Three distinct highlight colors students can choose from.
// Colors pulled from the CCO-adjacent palette: soft yellow, sage green, rose.
const COLORS = [
  { id: "yellow", bg: "#fff2a8", border: "#f5d85a", label: "Yellow" },
  { id: "green", bg: "#d8f1b8", border: "#89bd40", label: "Green" },
  { id: "pink", bg: "#ffd4e3", border: "#e85a87", label: "Pink" },
] as const;

export function HighlightTools({
  questionId,
  onHighlight,
  onClear,
  hasHighlights,
}: HighlightToolsProps) {
  const handleHighlight = useCallback(
    (color: (typeof COLORS)[number]) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (range.collapsed) return;

      const container = document.getElementById(
        `tp-question-text-${questionId}`
      );
      if (!container) return;
      if (!container.contains(range.commonAncestorContainer)) return;

      const mark = document.createElement("mark");
      mark.className = "tp-inline-highlight";
      mark.dataset.color = color.id;
      // setProperty with "important" guarantees this wins over any
      // stylesheet rule — Tailwind Typography's prose default otherwise
      // paints every <mark> the same yellow regardless of inline style.
      mark.style.setProperty("background-color", color.bg, "important");
      mark.style.setProperty("color", "inherit", "important");
      mark.style.setProperty("padding", "0.05em 0.2em", "important");
      mark.style.setProperty("border-radius", "0.2em", "important");
      mark.style.setProperty("box-decoration-break", "clone");
      mark.style.setProperty("-webkit-box-decoration-break", "clone");

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
    },
    [questionId, onHighlight]
  );

  const handleClear = useCallback(() => {
    onClear(questionId);
  }, [questionId, onClear]);

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider text-cco-muted font-semibold mr-1">
        Highlight
      </span>
      {COLORS.map((color) => (
        <button
          key={color.id}
          // CRITICAL: preventDefault on mousedown so the selection survives the click.
          // Without this the browser focuses the button and clears window.getSelection()
          // before our handler runs — highlights would silently fail.
          onMouseDown={(e) => {
            e.preventDefault();
            handleHighlight(color);
          }}
          onTouchStart={(e) => {
            // On iOS Safari, tapping a button also clears selection. Fire on touchstart.
            e.preventDefault();
            handleHighlight(color);
          }}
          title={`Highlight selection in ${color.label.toLowerCase()}`}
          aria-label={`Highlight ${color.label}`}
          className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition hover:shadow-sm active:scale-95"
          style={{
            borderColor: color.border,
            background: `${color.bg}40`,
          }}
        >
          <span
            className="w-3 h-3 rounded-full ring-1 ring-inset"
            style={{
              background: color.bg,
              boxShadow: `inset 0 0 0 1px ${color.border}`,
            }}
          />
          <span
            className="text-[11px] font-semibold"
            style={{ color: color.border }}
          >
            {color.label}
          </span>
        </button>
      ))}
      {hasHighlights && (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleClear();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border border-cco-border text-cco-muted hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition active:scale-95"
        >
          <Eraser size={11} />
          Clear all
        </button>
      )}
    </div>
  );
}
