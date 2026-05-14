import { AlertTriangle, Award } from "lucide-react";

export interface CeuExpirationBannerProps {
  // Earliest expiration across all CEU items linked to this test (most restrictive).
  earliestExpiration: Date;
}

export function CeuExpirationBanner({
  earliestExpiration,
}: CeuExpirationBannerProps) {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.floor(
    (earliestExpiration.getTime() - now.getTime()) / msPerDay
  );

  const dateStr = earliestExpiration.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (daysUntil < 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 text-sm">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold text-red-900">CEU credit expired</p>
          <p className="text-red-800 mt-0.5">
            This CEU credit expired on {dateStr}. AAPC will no longer accept
            newly-earned credit for this exam.
          </p>
        </div>
      </div>
    );
  }

  if (daysUntil <= 30) {
    const remaining =
      daysUntil === 0
        ? "today"
        : `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-900">
            CEU credit expires {remaining}
          </p>
          <p className="text-amber-800 mt-0.5">
            Pass this exam and submit your credit to AAPC before {dateStr}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cco-green-600/20 bg-cco-green-600/5 px-4 py-3 flex items-start gap-3 text-sm">
      <Award size={18} className="mt-0.5 shrink-0 text-cco-green-600" />
      <div>
        <p className="font-semibold text-cco-ink">
          CEU credit valid through {dateStr}
        </p>
        <p className="text-cco-muted mt-0.5">
          Pass this exam to earn AAPC continuing-education credit.
        </p>
      </div>
    </div>
  );
}
