import type { ReactNode } from "react";

/**
 * Catalog hero — editorial composition for the CCO Academy catalog.
 *
 * Aesthetic notes:
 *  - A 6px green spine on the left edge anchors the composition like a magazine
 *    masthead. On mobile the spine flips to a flat top bar so it never crowds the
 *    text on a narrow viewport.
 *  - Replaces the previous soft purple → green gradient wash. The Academy mark
 *    is already shown persistently in the TopBar, so the hero focuses on
 *    typography and structure rather than restating the brand.
 *  - Gold accent rule kept (slim, scarce) for continuity with the rest of the portal.
 */
export function CatalogHero({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden border border-cco-border bg-white">
      <div
        className="absolute inset-y-0 left-0 w-[6px] bg-cco-green hidden sm:block"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-[4px] bg-cco-green sm:hidden"
        aria-hidden
      />

      <div className="relative px-6 sm:px-9 py-8 sm:py-10 sm:pl-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cco-purple font-semibold mb-3">
            {eyebrow}
          </p>
          <h1 className="font-heading text-3xl sm:text-[40px] font-bold text-cco-ink leading-[1.05] tracking-tight">
            {title}
          </h1>
          <div className="mt-4 h-[3px] w-12 rounded-full bg-cco-gold" aria-hidden />
          {subtitle && (
            <p className="text-cco-muted mt-4 text-[15px] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}
