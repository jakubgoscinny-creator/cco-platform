"use client";

import { useRef, useCallback } from "react";
import {
  clampPaneWidth,
  PANE_WIDTH_MIN,
  PANE_WIDTH_MAX,
} from "@/lib/exam-engine";

interface PaneResizerProps {
  /** Current width of the left (question) pane, in percent. Drives a11y values. */
  widthPercent: number;
  /** The grid container to measure the pointer against (NOT the resizer's parent). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  onResize: (widthPercent: number) => void;
  // Optional explicit width: the keyboard path passes the just-nudged value so
  // persistence doesn't read a not-yet-committed `state.paneWidth` from a stale
  // render closure. Drag calls it with no arg (the pointerup/pointermove event
  // boundary guarantees the latest width is already committed).
  onResizeEnd: (widthPercent?: number) => void;
  onReset: () => void;
}

const KEYBOARD_STEP = 2;

/**
 * CCO-T074: draggable divider between the question pane and the scratch-pad/grid.
 *
 * The width is computed against the GRID CONTAINER passed via `containerRef`,
 * not `e.target.parentElement`. The old code measured the parent — which a later
 * responsive pass turned into the 12px wrapper column — so `rect.width ≈ 12px`,
 * the percentage exploded, and every drag snapped to the 35/70 clamp (felt dead).
 *
 * Desktop-only by design (`hidden md:flex`); on mobile the panes stack and there
 * is no divider. Keyboard-operable (Arrow keys nudge, Home/double-click reset).
 */
export function PaneResizer({
  widthPercent,
  containerRef,
  onResize,
  onResizeEnd,
  onReset,
}: PaneResizerProps) {
  const isDragging = useRef(false);

  const widthFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (!rect.width) return null;
      return clampPaneWidth(((clientX - rect.left) / rect.width) * 100);
    },
    [containerRef]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.dataset.dragging = "true";
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const next = widthFromClientX(e.clientX);
      if (next != null) onResize(next);
    },
    [widthFromClientX, onResize]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const el = e.currentTarget as HTMLElement;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      delete el.dataset.dragging;
      onResizeEnd();
    },
    [onResizeEnd]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = clampPaneWidth(widthPercent - KEYBOARD_STEP);
        onResize(next);
        onResizeEnd(next); // explicit — dispatch above isn't committed yet
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = clampPaneWidth(widthPercent + KEYBOARD_STEP);
        onResize(next);
        onResizeEnd(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        onReset();
      }
    },
    [widthPercent, onResize, onResizeEnd, onReset]
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize question and notes panes"
      aria-valuenow={Math.round(widthPercent)}
      aria-valuemin={PANE_WIDTH_MIN}
      aria-valuemax={PANE_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      title="Drag to resize · double-click to reset"
      className="group relative hidden md:flex h-full w-3 shrink-0 cursor-col-resize touch-none select-none items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cco-purple/40 data-[dragging=true]:bg-cco-purple/10"
      style={{
        background:
          "linear-gradient(180deg, rgba(129,84,129,0.18), rgba(137,189,64,0.18))",
        border: "1px solid rgba(129,84,129,0.16)",
      }}
    >
      {/* Centred grip dots — the discoverable affordance. */}
      <span
        aria-hidden
        className="flex flex-col items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging=true]:opacity-100"
      >
        <span className="block h-1 w-1 rounded-full bg-cco-purple/70" />
        <span className="block h-1 w-1 rounded-full bg-cco-purple/70" />
        <span className="block h-1 w-1 rounded-full bg-cco-purple/70" />
      </span>
    </div>
  );
}
