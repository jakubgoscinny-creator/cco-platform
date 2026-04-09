import { db } from "@/lib/db";
import { attempts, answers, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ExamClient } from "@/components/exam/ExamClient";
import type { QuestionSnapshot } from "@/lib/exam-engine";

export default async function ExamTakePage({
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
  if (attempt.status === "submitted" || attempt.status === "timed_out") {
    redirect(`/exam/results/${attemptId}`);
  }

  // Get test name
  const [test] = await db
    .select({ testName: tests.testName })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);

  // Get existing answers
  const existingAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, attemptId));

  const answerMap: Record<number, { selectedKey: string | null; flagged: boolean }> = {};
  for (const a of existingAnswers) {
    answerMap[a.questionPodioId] = {
      selectedKey: a.selectedKey,
      flagged: a.flagged ?? false,
    };
  }

  const questionSnapshots = (attempt.questionSnapshots ?? []) as QuestionSnapshot[];

  return (
    <ExamClient
      attemptId={attemptId}
      testName={test?.testName ?? "Exam"}
      questions={questionSnapshots}
      initialAnswers={answerMap}
      initialTimeRemaining={attempt.timeRemainingSeconds ?? 3600}
      initialScratchPad={attempt.scratchPad ?? ""}
    />
  );
}
