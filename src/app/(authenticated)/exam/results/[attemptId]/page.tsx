import { db } from "@/lib/db";
import { attempts, answers, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/shared/Card";
import { Pill } from "@/components/shared/Pill";
import Link from "next/link";
import { ArrowLeft, Trophy, Clock, FileText, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import type { QuestionSnapshot } from "@/lib/exam-engine";

export default async function ExamResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId: attemptIdStr } = await params;
  const attemptId = Number(attemptIdStr);
  if (!attemptId) redirect("/catalog");

  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.contactId !== session.contactId) redirect("/catalog");
  if (attempt.status === "in_progress") redirect(`/exam/take/${attemptId}`);

  const [test] = await db
    .select({ testName: tests.testName })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);

  const allAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, attemptId));

  const snapshots = (attempt.questionSnapshots ?? []) as QuestionSnapshot[];
  const snapshotMap = new Map(snapshots.map((s) => [s.podioItemId, s]));

  const score = attempt.scorePercent ? Number(attempt.scorePercent) : 0;
  const correct = allAnswers.filter((a) => a.isCorrect === true).length;
  const incorrect = allAnswers.filter((a) => a.isCorrect === false).length;
  const skipped = allAnswers.filter((a) => a.selectedKey === null).length;

  const timeTaken =
    attempt.startedAt && attempt.submittedAt
      ? Math.round(
          (new Date(attempt.submittedAt).getTime() -
            new Date(attempt.startedAt).getTime()) /
            60000
        )
      : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/gradebook"
        className="inline-flex items-center gap-1.5 text-sm text-cco-muted no-underline hover:text-cco-purple transition mb-6"
      >
        <ArrowLeft size={14} />
        Back to Gradebook
      </Link>

      {/* Score summary */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl font-bold text-cco-ink">
              {test?.testName ?? "Exam Results"}
            </h1>
            <p className="text-sm text-cco-muted mt-1">
              {attempt.submittedAt
                ? `Completed ${new Date(attempt.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Trophy
              size={24}
              className={score >= 70 ? "text-cco-green" : "text-red-400"}
            />
            <span
              className={`text-3xl font-bold ${
                score >= 70 ? "text-cco-green-600" : "text-red-600"
              }`}
            >
              {score}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-cco-border">
          <Stat
            icon={<CheckCircle size={16} className="text-cco-green" />}
            label="Correct"
            value={`${correct}`}
          />
          <Stat
            icon={<XCircle size={16} className="text-red-400" />}
            label="Incorrect"
            value={`${incorrect}`}
          />
          <Stat
            icon={<MinusCircle size={16} className="text-cco-muted" />}
            label="Skipped"
            value={`${skipped}`}
          />
          <Stat
            icon={<Clock size={16} className="text-cco-muted" />}
            label="Time"
            value={timeTaken ? `${timeTaken}m` : "--"}
          />
        </div>
      </Card>

      {/* Question review */}
      <h2 className="font-heading text-lg font-bold text-cco-ink mb-4">
        Question Review
      </h2>
      <div className="space-y-4">
        {(attempt.questionOrder as number[] ?? []).map((qId, i) => {
          const snapshot = snapshotMap.get(qId);
          const answer = allAnswers.find((a) => a.questionPodioId === qId);
          if (!snapshot) return null;

          const isCorrect = answer?.isCorrect === true;
          const isIncorrect = answer?.isCorrect === false;
          const isSkipped = answer?.selectedKey === null;

          return (
            <Card
              key={qId}
              className={`border-l-4 ${
                isCorrect
                  ? "border-l-cco-green"
                  : isIncorrect
                    ? "border-l-red-400"
                    : "border-l-gray-300"
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-cco-bg-soft text-cco-muted text-xs font-bold">
                  {i + 1}
                </span>
                <div>
                  <div
                    className="text-sm text-cco-ink prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: snapshot.questionText }}
                  />
                </div>
              </div>

              <div className="space-y-2 ml-10">
                {snapshot.options.map((opt) => {
                  const isSelected = answer?.selectedKey === opt.key;
                  const isCorrectOption = opt.key === snapshot.correctKey;
                  let optClass = "border-cco-border bg-white";
                  if (isCorrectOption) optClass = "border-cco-green bg-green-50";
                  if (isSelected && !isCorrectOption)
                    optClass = "border-red-400 bg-red-50";

                  return (
                    <div
                      key={opt.key}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border ${optClass}`}
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          isCorrectOption
                            ? "bg-cco-green text-white"
                            : isSelected
                              ? "bg-red-400 text-white"
                              : "bg-cco-bg-soft text-cco-muted"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="text-sm text-cco-ink">{stripHtml(opt.text)}</span>
                      {isCorrectOption && (
                        <CheckCircle size={14} className="text-cco-green ml-auto shrink-0" />
                      )}
                      {isSelected && !isCorrectOption && (
                        <XCircle size={14} className="text-red-400 ml-auto shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {snapshot.rationale && (
                <div className="ml-10 mt-3 p-3 bg-cco-bg-soft rounded-lg">
                  <p className="text-xs font-semibold text-cco-muted mb-1">
                    Rationale
                  </p>
                  <div
                    className="text-sm text-cco-ink prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: snapshot.rationale }}
                  />
                </div>
              )}

              <div className="ml-10 mt-2">
                {isCorrect && <Pill variant="green">Correct</Pill>}
                {isIncorrect && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-700">
                    Incorrect
                  </span>
                )}
                {isSkipped && <Pill>Skipped</Pill>}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600"
        >
          <FileText size={16} />
          Take Another Exam
        </Link>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-cco-muted">{label}</p>
        <p className="text-lg font-bold text-cco-ink">{value}</p>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
