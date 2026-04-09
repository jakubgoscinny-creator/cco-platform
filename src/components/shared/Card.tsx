import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-cco-card border border-cco-border rounded-2xl shadow-[0_6px_16px_rgba(15,23,42,0.06)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}
