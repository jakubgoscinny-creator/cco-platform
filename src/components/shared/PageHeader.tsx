/**
 * Warm page header — personalized greeting with gold accent bar.
 * Used on Catalog, Gradebook, and other top-level pages.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-cco-purple font-semibold mb-1.5">
            {eyebrow}
          </p>
        )}
        <div className="flex items-end gap-3">
          <h1 className="font-heading text-3xl sm:text-[32px] font-bold text-cco-ink leading-tight">
            {title}
          </h1>
        </div>
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
