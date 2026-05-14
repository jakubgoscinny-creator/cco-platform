import Image from "next/image";
import Link from "next/link";

const HORIZONTAL = { src: "/brand/cco-academy-horizontal-green.png", w: 4092, h: 460 };
const STACKED = { src: "/brand/cco-academy-stacked-green.png", w: 500, h: 500 };
const ICON_ROUND = { src: "/brand/cco-icon-round.png", w: 411, h: 411 };
const HEIGHTS: Record<"sm" | "md" | "lg", number> = { sm: 32, md: 48, lg: 112 };

/**
 * CCO Academy brand mark.
 *
 * Variants:
 *   - "horizontal" (default): full lockup with the "Academy" wordmark next to the CC tile.
 *     At size="sm" (header use), the round icon shows on small viewports and the full
 *     lockup shows on md+ — keeps the TopBar from overflowing on 375px screens.
 *   - "stacked": square lockup with "Academy" beneath the tile. Good for sign-in display.
 */
export function Logo({
  size = "sm",
  variant = "horizontal",
  showTagline = false,
  href = "/catalog",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "horizontal" | "stacked";
  showTagline?: boolean;
  href?: string | null;
  className?: string;
}) {
  const height = HEIGHTS[size];
  const align = variant === "stacked" ? "items-center" : "items-start";

  const mark =
    variant === "stacked" ? (
      <Image
        src={STACKED.src}
        alt="CCO Academy"
        width={STACKED.w}
        height={STACKED.h}
        priority
        className="block"
        style={{ height: `${height}px`, width: `${height}px` }}
      />
    ) : (
      <>
        {/* Mobile: round icon only */}
        <Image
          src={ICON_ROUND.src}
          alt="CCO Academy"
          width={ICON_ROUND.w}
          height={ICON_ROUND.h}
          priority
          className="block md:hidden rounded-lg"
          style={{ height: `${height}px`, width: `${height}px` }}
        />
        {/* md+: full horizontal lockup */}
        <Image
          src={HORIZONTAL.src}
          alt="CCO Academy"
          width={HORIZONTAL.w}
          height={HORIZONTAL.h}
          priority
          className="hidden md:block w-auto"
          style={{ height: `${height}px` }}
        />
      </>
    );

  const inner = (
    <div className={`inline-flex flex-col ${align} gap-3 ${className}`}>
      {mark}
      {showTagline && (
        <span className="text-[10px] uppercase tracking-[0.24em] text-cco-purple font-semibold">
          Learn it · Get certified · Stay certified
        </span>
      )}
    </div>
  );

  if (href == null) return inner;
  return (
    <Link href={href} className="no-underline" aria-label="CCO Academy">
      {inner}
    </Link>
  );
}
