/**
 * Warm page header — personalized greeting with gold accent bar.
 * Two variants:
 *   - default: plain (for sub-pages)
 *   - gradient: soft purple → green wash (for top-level pages)
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
  gradient = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  gradient?: boolean;
}) {
  const Inner = (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-cco-purple font-semibold mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-3xl sm:text-[32px] font-bold text-cco-ink leading-tight">
          {title}
        </h1>
        {/* Gold accent bar — tiny premium touch */}
        <div className="mt-3 h-[3px] w-12 rounded-full bg-[#fcb900]" />
        {subtitle && (
          <p className="text-cco-muted mt-3 text-[15px] max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );

  if (!gradient) {
    return <div className="mb-8">{Inner}</div>;
  }

  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden border border-cco-border">
      {/* Soft brand wash — purple fade → neutral → green fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(100deg, rgba(129,84,129,0.12) 0%, rgba(246,247,251,0.7) 45%, rgba(137,189,64,0.14) 100%), #ffffff",
        }}
      />
      <div className="relative p-7 sm:p-9">{Inner}</div>
    </div>
  );
}

export function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullNameOrEmail: string): string {
  const name = fullNameOrEmail.includes("@")
    ? fullNameOrEmail.split("@")[0]
    : fullNameOrEmail;
  return name.split(/[\s.]+/)[0] ?? name;
}
