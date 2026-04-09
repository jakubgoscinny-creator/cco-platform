import { Card } from "@/components/shared/Card";

interface DomainScore {
  domain: string;
  correct: number;
  total: number;
}

export function DomainSummary({ scores }: { scores: DomainScore[] }) {
  if (!scores.length) return null;

  return (
    <Card className="mb-6">
      <h2 className="font-heading font-semibold text-cco-ink mb-4">
        Domain Performance
      </h2>
      <div className="space-y-3">
        {scores.map((s) => {
          const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <div key={s.domain}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-cco-ink">
                  {s.domain}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    pct >= 80
                      ? "text-cco-green-600"
                      : pct >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 80
                      ? "bg-cco-green"
                      : pct >= 60
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-cco-muted mt-0.5">
                {s.correct}/{s.total} correct
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
