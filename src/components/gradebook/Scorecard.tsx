import { Trophy, Target, TrendingUp, CalendarClock } from "lucide-react";

export interface ScorecardStats {
  totalTaken: number;
  passRate: number | null;       // 0..100, null if no completed
  averageScore: number | null;   // 0..100, null if no scored
  lastActivity: Date | null;
}

type TileAccent = "purple" | "green" | "gold" | "slate";

// Calm, data-appropriate tiles: a clean white card carries the numbers, while a
// small gradient icon medallion keeps the catalog's brand colour-coding in a
// contained way (no full-bleed gradient competing with the gradient PageHeader).
// Medallion icon colour is contrast-safe: white on dark purple/slate, ink on the
// bright green/gold.
const ACCENT: Record<TileAccent, { grad: string; icon: string }> = {
  purple: { grad: "from-cco-purple to-cco-purple-700", icon: "text-white" },
  green: { grad: "from-cco-green to-cco-green-600", icon: "text-cco-ink" },
  gold: { grad: "from-cco-gold to-cco-gold-dark", icon: "text-cco-ink" },
  slate: { grad: "from-cco-slate to-cco-ink", icon: "text-white" },
};

export function Scorecard({ stats }: { stats: ScorecardStats }) {
  const tiles: {
    label: string;
    value: string;
    sub: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: TileAccent;
  }[] = [
    {
      label: "Tests taken",
      value: stats.totalTaken.toString(),
      sub: stats.totalTaken === 1 ? "exam attempted" : "exams attempted",
      icon: Trophy,
      accent: "purple",
    },
    {
      label: "Pass rate",
      value: stats.passRate != null ? `${Math.round(stats.passRate)}%` : "—",
      sub: stats.passRate != null ? "scored 70% or above" : "no completed exams yet",
      icon: Target,
      accent: "green",
    },
    {
      label: "Average score",
      value:
        stats.averageScore != null
          ? `${Math.round(stats.averageScore)}%`
          : "—",
      sub: stats.averageScore != null ? "across all attempts" : "—",
      icon: TrendingUp,
      accent: "gold",
    },
    {
      label: "Last activity",
      value: stats.lastActivity ? relativeShort(stats.lastActivity) : "—",
      sub: stats.lastActivity
        ? formatAbsolute(stats.lastActivity)
        : "no activity yet",
      icon: CalendarClock,
      accent: "slate",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {tiles.map((t) => (
        <ScorecardTile key={t.label} {...t} />
      ))}
    </div>
  );
}

function ScorecardTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: TileAccent;
}) {
  const a = ACCENT[accent];

  return (
    <div className="bg-cco-card border border-cco-border rounded-2xl p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cco-muted">
          {label}
        </span>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br ${a.grad} ${a.icon}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="font-heading text-2xl sm:text-[28px] font-extrabold text-cco-ink leading-tight">
        {value}
      </p>
      <p className="text-xs text-cco-muted mt-1 leading-snug">{sub}</p>
    </div>
  );
}

function relativeShort(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function formatAbsolute(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
