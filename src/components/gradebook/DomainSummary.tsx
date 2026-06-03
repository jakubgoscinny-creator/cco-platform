import { Card } from "@/components/shared/Card";
import { BarChart3 } from "lucide-react";

interface DomainScore {
  domain: string;
  correct: number;
  total: number;
}

export function DomainSummary({ scores }: { scores: DomainScore[] }) {
  if (!scores.length) return null;

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cco-purple/10 text-cco-purple">
          <BarChart3 size={18} />
        </span>
        <div>
          <h2 className="font-heading text-lg font-bold text-cco-ink leading-tight">
            Domain performance
          </h2>
          <p className="text-xs text-cco-muted mt-0.5">
            Your weakest areas first — where focused review pays off most.
          </p>
        </div>
      </div>
      <div className="space-y-3.5">
        {scores.map((s) => {
          const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          const tone =
            pct >= 80
              ? "text-cco-green-600"
              : pct >= 60
                ? "text-cco-gold-dark"
                : "text-red-600";
          const bar =
            pct >= 80
              ? "bg-cco-green"
              : pct >= 60
                ? "bg-cco-gold"
                : "bg-red-400";
          return (
            <div key={s.domain}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-cco-ink">
                  {s.domain}
                </span>
                <span className={`text-sm font-bold ${tone}`}>{pct}%</span>
              </div>
              <div className="w-full h-2 bg-cco-bg-soft rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bar}`}
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
