import { Trophy, Target, TrendingUp, CalendarClock } from "lucide-react";

export interface ScorecardStats {
  totalTaken: number;
  passRate: number | null;       // 0..100, null if no completed
  averageScore: number | null;   // 0..100, null if no scored
  lastActivity: Date | null;
}

export function Scorecard({ stats }: { stats: ScorecardStats }) {
  const tiles: {
    label: string;
    value: string;
    sub: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: "purple" | "green" | "blue" | "amber";
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
      accent: "blue",
    },
    {
      label: "Last activity",
      value: stats.lastActivity ? relativeShort(stats.lastActivity) : "—",
      sub: stats.lastActivity
        ? formatAbsolute(stats.lastActivity)
        : "no activity yet",
      icon: CalendarClock,
      accent: "amber",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
  accent: "purple" | "green" | "blue" | "amber";
}) {
  const ring = {
    purple: "bg-cco-purple/10 text-cco-purple",
    green: "bg-cco-green-600/10 text-cco-green-600",
    blue: "bg-blue-600/10 text-blue-600",
    amber: "bg-amber-500/10 text-amber-600",
  }[accent];

  return (
    <div className="bg-white border border-cco-border rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cco-muted">
          {label}
        </span>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${ring}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="font-heading text-2xl font-bold text-cco-ink leading-tight">
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
