"use client";

import { useRef, useCallback } from "react";

interface PaneResizerProps {
  onResize: (widthPercent: number) => void;
  onResizeEnd: () => void;
}

export function PaneResizer({ onResize, onResizeEnd }: PaneResizerProps) {
  const isDragging = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      (e.target as HTMLElement).classList.add("is-dragging");
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const shell = (e.target as HTMLElement).parentElement;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      if (!rect.width) return;
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(35, Math.min(70, raw));
      onResize(Math.round(clamped * 10) / 10);
    },
    [onResize]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      (e.target as HTMLElement).classList.remove("is-dragging");
      onResizeEnd();
    },
    [onResizeEnd]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="hidden md:block w-3 shrink-0 cursor-col-resize touch-none rounded-full transition-shadow"
      style={{
        background:
          "linear-gradient(180deg, rgba(129,84,129,0.25), rgba(137,189,64,0.25))",
        border: "1px solid rgba(129,84,129,0.18)",
      }}
      title="Drag to resize"
    />
  );
}
