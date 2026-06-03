import { Trophy, Target, TrendingUp, CalendarClock } from "lucide-react";

export interface ScorecardStats {
  totalTaken: number;
  passRate: number | null;       // 0..100, null if no completed
  averageScore: number | null;   // 0..100, null if no scored
  lastActivity: Date | null;
}

type TileAccent = "purple" | "green" | "gold" | "slate";

// Brand-gradient tiles that echo the catalog's section headers (CCO-T046):
// full brand gradient + a frosted icon medallion + big Sora value. Contrast-safe
// text — white on the dark purple/slate, ink on the bright green/gold.
const ACCENT: Record<
  TileAccent,
  { grad: string; text: string; label: string; sub: string; chip: string }
> = {
  purple: {
    grad: "from-cco-purple to-cco-purple-700",
    text: "text-white",
    label: "text-white/80",
    sub: "text-white/70",
    chip: "bg-white/20 text-white",
  },
  green: {
    grad: "from-cco-green to-cco-green-600",
    text: "text-cco-ink",
    label: "text-cco-ink/70",
    sub: "text-cco-ink/70",
    chip: "bg-black/10 text-cco-ink",
  },
  gold: {
    grad: "from-cco-gold to-cco-gold-dark",
    text: "text-cco-ink",
    label: "text-cco-ink/70",
    sub: "text-cco-ink/70",
    chip: "bg-black/10 text-cco-ink",
  },
  slate: {
    grad: "from-cco-slate to-cco-ink",
    text: "text-white",
    label: "text-white/75",
    sub: "text-white/65",
    chip: "bg-white/15 text-white",
  },
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
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.grad} ${a.text} p-4 shadow-[0_4px_16px_rgba(15,23,42,0.10)] transition-shadow hover:shadow-[0_14px_40px_rgba(15,23,42,0.14)]`}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${a.label}`}
        >
          {label}
        </span>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl backdrop-blur ${a.chip}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="font-heading text-2xl sm:text-[28px] font-extrabold leading-tight">
        {value}
      </p>
      <p className={`text-xs mt-1 leading-snug ${a.sub}`}>{sub}</p>
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
