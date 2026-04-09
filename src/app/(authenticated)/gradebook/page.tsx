import { db } from "@/lib/db";
import { attempts, tests } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionContact } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GradebookTable, type GradebookRow } from "@/components/gradebook/GradebookTable";
import { DomainSummary } from "@/components/gradebook/DomainSummary";
import { DataLineage } from "@/components/shared/DataLineage";

export default async function GradebookPage() {
  const user = await getSessionContact();
  if (!user) redirect("/sign-in");

  const userAttempts = await db
    .select({
      id: attempts.id,
      testPodioId: attempts.testPodioId,
      status: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      scorePercent: attempts.scorePercent,
      domainScores: attempts.domainScores,
      timeRemainingSeconds: attempts.timeRemainingSeconds,
    })
    .from(attempts)
    .where(eq(attempts.contactId, user.contactId))
    .orderBy(desc(attempts.startedAt));

  // Fetch test names for all attempts
  const testIds = [...new Set(userAttempts.map((a) => a.testPodioId))];
  const testNameMap = new Map<number, string>();
  if (testIds.length) {
    const testRows = await db
      .select({ podioItemId: tests.podioItemId, testName: tests.testName })
      .from(tests);
    for (const t of testRows) {
      testNameMap.set(t.podioItemId, t.testName);
    }
  }

  const rows: GradebookRow[] = userAttempts.map((a) => ({
    attemptId: a.id,
    testName: testNameMap.get(a.testPodioId) ?? `Test #${a.testPodioId}`,
    date: a.startedAt
      ? new Date(a.startedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "--",
    status: a.status ?? "in_progress",
    scorePercent: a.scorePercent ? Number(a.scorePercent) : null,
    timeTaken: formatTimeTaken(a.startedAt, a.submittedAt),
    domainScores: a.domainScores as Record<
      string,
      { correct: number; total: number }
    > | null,
  }));

  // Aggregate domain performance across all completed attempts
  const domainAgg = new Map<string, { correct: number; total: number }>();
  for (const row of rows) {
    if (row.status !== "submitted" || !row.domainScores) continue;
    for (const [domain, score] of Object.entries(row.domainScores)) {
      const existing = domainAgg.get(domain) ?? { correct: 0, total: 0 };
      existing.correct += score.correct;
      existing.total += score.total;
      domainAgg.set(domain, existing);
    }
  }

  const domainScores = Array.from(domainAgg.entries())
    .map(([domain, s]) => ({ domain, ...s }))
    .sort((a, b) => {
      const pctA = a.total > 0 ? a.correct / a.total : 0;
      const pctB = b.total > 0 ? b.correct / b.total : 0;
      return pctA - pctB; // weakest first
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-cco-ink">
          Gradebook
        </h1>
        <DataLineage syncedAt={new Date()} />
      </div>

      <DomainSummary scores={domainScores} />

      <GradebookTable rows={rows} />
    </div>
  );
}

function formatTimeTaken(
  startedAt: Date | null,
  submittedAt: Date | null
): string | null {
  if (!startedAt || !submittedAt) return null;
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}
