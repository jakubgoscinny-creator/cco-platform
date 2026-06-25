"use client";

import { useCallback } from "react";
import { Eraser, Highlighter } from "lucide-react";

interface HighlightToolsProps {
  questionId: number;
  onHighlight: (questionId: number, html: string) => void;
  onClear: (questionId: number) => void;
  hasHighlights: boolean;
}

// Three distinct highlighter colours. Soft, paper-highlighter tones on-brand:
// warm yellow, sage green, rose.
const COLORS = [
  { id: "yellow", bg: "#fff2a8", border: "#e6c33a", label: "Yellow" },
  { id: "green", bg: "#d8f1b8", border: "#89bd40", label: "Green" },
  { id: "pink", bg: "#ffd4e3", border: "#e85a87", label: "Pink" },
] as const;

export function HighlightTools({
  questionId,
  onHighlight,
  onClear,
  hasHighlights,
}: HighlightToolsProps) {
  const applyHighlight = useCallback(
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

      try {
        // Pull the selected content out (this splits any existing highlight
        // marks at the selection boundaries), DROP any highlight wrappers that
        // were fully inside it, then re-wrap the whole selection in the chosen
        // colour. This makes overlapping / cross-colour highlights cleanly
        // RE-COLOUR instead of nesting or fragmenting — the old `surroundContents`
        // path split a word into separately-padded marks, which showed as gaps
        // between letters when you coloured half a word.
        const fragment = range.extractContents();
        fragment
          .querySelectorAll?.("mark.tp-inline-highlight")
          .forEach((m) => {
            const parent = m.parentNode;
            if (!parent) return;
            while (m.firstChild) parent.insertBefore(m.firstChild, m);
            parent.removeChild(m);
          });

        const mark = document.createElement("mark");
        mark.className = "tp-inline-highlight";
        mark.dataset.color = color.id;
        // setProperty with "important" guarantees this wins over any stylesheet.
        mark.style.setProperty("background-color", color.bg, "important");
        mark.style.setProperty("color", "inherit", "important");
        // VERTICAL-ONLY padding: horizontal padding made adjacent / split marks
        // show a gap between letters when cross-colouring a word.
        mark.style.setProperty("padding", "0.12em 0", "important");
        mark.style.setProperty("border-radius", "0.15em", "important");
        mark.style.setProperty("box-decoration-break", "clone");
        mark.style.setProperty("-webkit-box-decoration-break", "clone");

        mark.appendChild(fragment);
        range.insertNode(mark);
        container.normalize(); // merge adjacent text nodes left by the split
        // Drop any now-empty highlight wrappers left when a span was fully
        // re-coloured (extractContents can leave an emptied <mark>).
        container
          .querySelectorAll("mark.tp-inline-highlight")
          .forEach((m) => {
            if (!m.textContent) m.remove();
          });
      } catch {
        return;
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cco-muted font-semibold">
          <Highlighter size={13} className="text-cco-purple/70" />
          Highlight
        </span>
        <div className="flex items-center gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color.id}
              // CRITICAL: preventDefault on mousedown so the text selection
              // survives the click (the browser would otherwise clear it on focus).
              onMouseDown={(e) => {
                e.preventDefault();
                applyHighlight(color);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                applyHighlight(color);
              }}
              title={`Highlight selection in ${color.label.toLowerCase()}`}
              aria-label={`Highlight ${color.label}`}
              className="group relative h-7 w-7 rounded-full border transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-90"
              style={{ background: color.bg, borderColor: color.border }}
            >
              <span
                aria-hidden
                className="absolute inset-1 rounded-full opacity-0 ring-1 ring-inset transition group-hover:opacity-100"
                style={{ boxShadow: `inset 0 0 0 1.5px ${color.border}` }}
              />
            </button>
          ))}
        </div>
        {hasHighlights && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleClear();
            }}
            aria-label="Clear all highlights"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-cco-border text-cco-muted hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition active:scale-95"
          >
            <Eraser size={12} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>
      {/* Discoverability hint — the gesture (select first) isn't obvious. */}
      {!hasHighlights && (
        <p className="text-[11px] text-cco-muted/90">
          Select text in the question, then tap a colour.
        </p>
      )}
    </div>
  );
}
