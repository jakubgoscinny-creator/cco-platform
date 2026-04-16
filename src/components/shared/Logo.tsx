import Image from "next/image";
import Link from "next/link";

/**
 * CCO brand mark. Two variants:
 *  - <Logo size="sm" /> -- compact: just the logo tile (used in TopBar)
 *  - <Logo size="md" showTagline /> -- logo + wordmark + tagline (used on sign-in)
 */
export function Logo({
  size = "sm",
  showTagline = false,
  href = "/catalog",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  href?: string | null;
  className?: string;
}) {
  const tileSize = size === "lg" ? 64 : size === "md" ? 48 : 36;
  const wordSize =
    size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-base";

  const inner = (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="relative rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(129,84,129,0.25)] ring-1 ring-black/5"
        style={{ width: tileSize, height: tileSize }}
      >
        <Image
          src="/brand/cco-logo.png"
          alt="CCO"
          width={tileSize}
          height={tileSize}
          className="object-cover"
          priority
        />
      </div>
      <div className="leading-tight">
        <div className={`font-heading font-bold text-cco-ink ${wordSize}`}>
          CCO
          <span className="text-cco-muted font-normal ml-1.5">Portal</span>
        </div>
        {showTagline && (
          <div className="text-[10px] uppercase tracking-[0.2em] text-cco-purple mt-1 font-semibold">
            Learn it · Get certified · Stay certified
          </div>
        )}
      </div>
    </div>
  );

  if (href == null) return inner;
  return (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  );
}
