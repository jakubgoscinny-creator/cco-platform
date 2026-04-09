"use client";

import { X } from "lucide-react";

interface ScratchPadProps {
  value: string;
  onChange: (content: string) => void;
  onClose: () => void;
}

export function ScratchPad({ value, onChange, onClose }: ScratchPadProps) {
  return (
    <div className="border-t border-cco-border bg-white shrink-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-cco-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-cco-muted">
          Scratch Pad
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded text-cco-muted hover:text-cco-ink transition"
        >
          <X size={14} />
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your notes here... (saved automatically)"
        className="w-full h-32 px-4 py-3 text-sm text-cco-ink bg-white resize-none focus:outline-none"
      />
    </div>
  );
}
