"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { attempts, answers, tests } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { syncQuestionsForTest } from "@/lib/sync";

// ---------------------------------------------------------------------------
// Start exam — creates an attempt and redirects to the exam page
// ---------------------------------------------------------------------------

export async function startExamAction(
  testPodioId: number
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  // Fetch test details
  const [test] = await db
    .select()
    .from(tests)
    .where(eq(tests.podioItemId, testPodioId))
    .limit(1);

  if (!test) return { error: "Test not found" };

  // Sync questions from Podio
  const questionList = await syncQuestionsForTest(testPodioId);
  if (!questionList.length) return { error: "No questions available for this test" };

  // Create attempt
  const questionOrder = questionList.map((q) => q.podioItemId);

  // Snapshot questions at attempt time (question versioning)
  const snapshots = questionList.map((q) => ({
    podioItemId: q.podioItemId,
    questionText: q.questionText,
    options: q.options,
    correctKey: q.correctKey,
    rationale: q.rationale,
  }));

  const [attempt] = await db
    .insert(attempts)
    .values({
      contactId: session.contactId,
      testPodioId: testPodioId,
      status: "in_progress",
      timeRemainingSeconds: (test.timeLimitMinutes ?? 60) * 60,
      questionOrder,
      questionSnapshots: snapshots as unknown as Record<string, unknown>,
    })
    .returning({ id: attempts.id });

  // Create answer placeholders for each question
  await Promise.all(
    questionOrder.map((qId) =>
      db.insert(answers).values({
        attemptId: attempt.id,
        questionPodioId: qId,
        selectedKey: null,
        isCorrect: null,
        flagged: false,
      })
    )
  );

  redirect(`/exam/take/${attempt.id}`);
}

// ---------------------------------------------------------------------------
// Save answer — persists a single answer selection
// ---------------------------------------------------------------------------

export async function saveAnswerAction(
  attemptId: number,
  questionPodioId: number,
  selectedKey: string | null,
  flagged: boolean
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  // Verify attempt belongs to user
  const [attempt] = await db
    .select({ contactId: attempts.contactId, status: attempts.status })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.contactId !== session.contactId) return;
  if (attempt.status !== "in_progress") return;

  await db
    .update(answers)
    .set({
      selectedKey,
      flagged,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(answers.attemptId, attemptId),
        eq(answers.questionPodioId, questionPodioId)
      )
    );
}

// ---------------------------------------------------------------------------
// Save exam state — persists timer and scratch pad
// ---------------------------------------------------------------------------

export async function saveExamStateAction(
  attemptId: number,
  timeRemainingSeconds: number,
  scratchPad: string
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const [attempt] = await db
    .select({ contactId: attempts.contactId, status: attempts.status })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.contactId !== session.contactId) return;
  if (attempt.status !== "in_progress") return;

  await db
    .update(attempts)
    .set({ timeRemainingSeconds, scratchPad })
    .where(eq(attempts.id, attemptId));
}

// ---------------------------------------------------------------------------
// Submit exam — calculates scores and marks complete
// ---------------------------------------------------------------------------

export async function submitExamAction(
  attemptId: number
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.contactId !== session.contactId)
    return { error: "Attempt not found" };
  if (attempt.status !== "in_progress")
    return { error: "Exam already submitted" };

  // Get all answers
  const allAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, attemptId));

  // Get question snapshots for correct answers
  const snapshots = (attempt.questionSnapshots as Array<{
    podioItemId: number;
    correctKey: string;
  }>) ?? [];

  const correctMap = new Map(snapshots.map((s) => [s.podioItemId, s.correctKey]));

  // Score each answer
  let correct = 0;
  let total = 0;

  for (const ans of allAnswers) {
    const correctKey = correctMap.get(ans.questionPodioId);
    if (!correctKey) continue;
    total++;
    const isCorrect = ans.selectedKey === correctKey;
    if (isCorrect) correct++;

    await db
      .update(answers)
      .set({ isCorrect })
      .where(eq(answers.id, ans.id));
  }

  const scorePercent = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;

  await db
    .update(attempts)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      scorePercent: String(scorePercent),
      timeRemainingSeconds: 0,
    })
    .where(eq(attempts.id, attemptId));

  redirect(`/exam/results/${attemptId}`);
}
