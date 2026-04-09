"use client";

import { X } from "lucide-react";

interface ScratchPadProps {
  value: string;
  onChange: (content: string) => void;
  onClose?: () => void;
  mode?: "inline" | "drawer";
}

export function ScratchPad({
  value,
  onChange,
  onClose,
  mode = "inline",
}: ScratchPadProps) {
  if (mode === "drawer") {
    return (
      <div className="border-t border-cco-border bg-white shrink-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-cco-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-cco-muted">
            Scratch Pad
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-cco-muted hover:text-cco-ink transition"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Universal notes for this attempt. Visible on every question and saved automatically."
          className="w-full h-32 px-4 py-3 text-sm text-cco-ink bg-white resize-none focus:outline-none"
        />
      </div>
    );
  }

  // Inline mode — always visible in right pane
  return (
    <div className="flex flex-col">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-cco-muted mb-2">
        Scratch Pad
      </h4>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Universal notes for this attempt. Visible on every question and saved automatically."
        className="flex-1 min-h-[96px] w-full px-3 py-2.5 text-sm text-cco-ink bg-white border border-cco-border rounded-xl resize-vertical focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
      />
    </div>
  );
}
