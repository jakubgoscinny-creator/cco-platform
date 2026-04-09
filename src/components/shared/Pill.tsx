import { type ReactNode } from "react";

type PillVariant = "default" | "green" | "purple";

const variantClasses: Record<PillVariant, string> = {
  default:
    "border-cco-border bg-white text-cco-muted",
  green:
    "border-[rgba(137,189,64,0.35)] bg-[rgba(137,189,64,0.12)] text-[#3f5a12]",
  purple:
    "border-[rgba(129,84,129,0.35)] bg-[rgba(129,84,129,0.12)] text-cco-purple-700",
};

export function Pill({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: PillVariant;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
