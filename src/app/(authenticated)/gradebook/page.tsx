import { db } from "@/lib/db";
import { attempts, tests } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionContact } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GradebookTable, type GradebookRow } from "@/components/gradebook/GradebookTable";
import { DomainSummary } from "@/components/gradebook/DomainSummary";
import { Scorecard } from "@/components/gradebook/Scorecard";
import { PastResults, type PastResultRow } from "@/components/gradebook/PastResults";
import { DataLineage } from "@/components/shared/DataLineage";
import { PageHeader, firstName } from "@/components/shared/PageHeader";
import { getLegacyResultsForContact } from "@/lib/legacy-results";

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

  // Lazy fetch legacy test results from Podio (cached 24h in Neon).
  // Errors here shouldn't break the page — show portal data without legacy.
  let legacyRows: PastResultRow[] = [];
  try {
    const legacy = await getLegacyResultsForContact(user.contactId);
    legacyRows = legacy.map((r) => ({
      podioItemId: r.podioItemId,
      appItemId: r.appItemId,
      date: r.dateTaken
        ? new Date(r.dateTaken).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
      testName: r.testName ?? "",
      scorePercent: r.scorePercent != null ? Number(r.scorePercent) : null,
      passed: r.passed,
      source: r.source ?? "",
      type: r.type ?? "",
      legacyCertUrl: r.legacyCertUrl ?? "",
      testItemId: r.testItemId,
      hasCeuCertificate: r.aapcTemplateFileId != null,
    }));
  } catch (err) {
    console.error("Failed to load legacy test results:", err);
  }

  // Combined stats across new-portal attempts + legacy results
  const completed = rows.filter((r) => r.status === "submitted");
  const completedScores = completed
    .map((r) => r.scorePercent)
    .filter((s): s is number => s != null);
  const legacyScores = legacyRows
    .map((r) => r.scorePercent)
    .filter((s): s is number => s != null);
  const allScores = [...completedScores, ...legacyScores];

  const totalTaken = completed.length + legacyRows.length;
  const passedCount =
    completedScores.filter((s) => s >= 70).length +
    legacyScores.filter((s) => s >= 70).length;
  const passRate = totalTaken > 0 ? (passedCount / totalTaken) * 100 : null;
  const averageScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null;

  const lastActivityCandidates: Date[] = [
    ...completed
      .map((r) => (r.date ? new Date(r.date) : null))
      .filter((d): d is Date => d != null && !isNaN(d.getTime())),
    ...legacyRows
      .map((r) => new Date(r.date))
      .filter((d) => !isNaN(d.getTime())),
  ];
  const lastActivity = lastActivityCandidates.length
    ? new Date(Math.max(...lastActivityCandidates.map((d) => d.getTime())))
    : null;

  const greet = user.fullName ? firstName(user.fullName) : null;
  const subtitle =
    totalTaken === 0
      ? "Every attempt teaches you something. Start your first exam whenever you're ready."
      : passedCount > 0
        ? `You've passed ${passedCount} exam${passedCount > 1 ? "s" : ""} so far. Keep going.`
        : `${totalTaken} attempt${totalTaken > 1 ? "s" : ""} in the books. Every one is progress.`;

  return (
    <div>
      <PageHeader
        gradient
        eyebrow={greet ? `${greet}'s Progress` : "Your Progress"}
        title="Your gradebook"
        subtitle={subtitle}
        right={<DataLineage syncedAt={new Date()} />}
      />

      <Scorecard
        stats={{
          totalTaken,
          passRate,
          averageScore,
          lastActivity,
        }}
      />

      <DomainSummary scores={domainScores} />

      {rows.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <div>
              <h2 className="font-heading text-lg font-bold text-cco-ink">
                Recent attempts
              </h2>
              <p className="text-sm text-cco-muted mt-0.5">
                Tests taken in the new portal — full answer review available.
              </p>
            </div>
            <span className="text-xs text-cco-muted">
              {rows.length} {rows.length === 1 ? "attempt" : "attempts"}
            </span>
          </div>
          <GradebookTable rows={rows} />
        </section>
      )}

      <PastResults rows={legacyRows} />

      {rows.length === 0 && legacyRows.length === 0 && (
        <GradebookTable rows={[]} />
      )}
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
