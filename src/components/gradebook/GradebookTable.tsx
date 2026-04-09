import Link from "next/link";
import { Play, Eye } from "lucide-react";
import { Pill } from "@/components/shared/Pill";

export interface GradebookRow {
  attemptId: number;
  testName: string;
  date: string;
  status: string; // 'in_progress' | 'submitted' | 'timed_out'
  scorePercent: number | null;
  timeTaken: string | null;
  domainScores: Record<string, { correct: number; total: number }> | null;
}

export function GradebookTable({ rows }: { rows: GradebookRow[] }) {
  if (!rows.length) {
    return (
      <div className="text-center py-16">
        <p className="text-cco-muted text-lg">No exam attempts yet</p>
        <p className="text-cco-muted text-sm mt-1">
          Start an exam from the catalog to see your history here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-cco-border">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-[#f3f5fa]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Exam
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Score
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Time
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cco-muted">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.attemptId}
              className="border-t border-cco-border hover:bg-cco-bg-soft transition-colors"
            >
              <td className="px-4 py-3 font-medium text-cco-ink">
                {row.testName}
              </td>
              <td className="px-4 py-3 text-sm text-cco-muted">{row.date}</td>
              <td className="px-4 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="px-4 py-3 text-sm">
                {row.scorePercent != null ? (
                  <span
                    className={`font-semibold ${
                      row.scorePercent >= 80
                        ? "text-cco-green-600"
                        : row.scorePercent >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {row.scorePercent}%
                  </span>
                ) : (
                  <span className="text-cco-muted">--</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-cco-muted">
                {row.timeTaken ?? "--"}
              </td>
              <td className="px-4 py-3 text-right">
                {row.status === "in_progress" ? (
                  <Link
                    href={`/exam/take/${row.attemptId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cco-purple text-white text-xs font-semibold no-underline transition hover:bg-cco-purple-600"
                  >
                    <Play size={12} />
                    Resume
                  </Link>
                ) : (
                  <Link
                    href={`/exam/results/${row.attemptId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cco-purple text-cco-purple text-xs font-semibold no-underline transition hover:bg-cco-purple hover:text-white"
                  >
                    <Eye size={12} />
                    Review
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  switch (status) {
    case "in_progress":
      return <Pill variant="purple">In Progress</Pill>;
    case "submitted":
      return <Pill variant="green">Completed</Pill>;
    case "timed_out":
      return <Pill>Timed Out</Pill>;
    default:
      return <Pill>{status}</Pill>;
  }
}
