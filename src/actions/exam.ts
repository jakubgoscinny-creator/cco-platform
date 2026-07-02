"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { attempts, answers, tests, contacts, feedback } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { syncQuestionsForTest, getMirroredQuestionsForTest } from "@/lib/sync";
import {
  createItem,
  getItem,
  PODIO_APPS,
  QUESTION_FEEDBACK_FIELDS,
  QUESTION_FEEDBACK_OPTIONS,
} from "@/lib/podio";
import { canAccessTest } from "@/lib/circle-access";
import { writeTestResultToPodio } from "@/lib/test-results-write";
import {
  FEEDBACK_COMMENT_MAX,
  isFeedbackDifficulty,
  isFeedbackIssueType,
} from "@/lib/feedback-options";

// Podio Test Attempts app (30626082) field IDs
const ATTEMPT_FIELDS = {
  TEST: 275654681,                // app ref → Tests
  DOMAINS: 275654682,             // app ref → Domains
  STATUS: 275654686,              // category: In Progress, Completed, Abandoned
  STARTED_AT: 275654688,          // date
  COMPLETED_AT: 275654689,        // date
  CONTACT_ITEM_ID: 275654684,     // number
  ATTEMPT_NUMBER: 275654687,      // number
  DURATION_MINUTES: 275654690,    // number
  SCORE: 275654691,               // number
  QUESTION_COUNT: 275654692,      // number
  ATTEMPT_NAME: 275654680,        // text
  CONTACT_NAME: 275654685,        // text
  SERVED_QUESTION_IDS: 275654694, // text [H]
  RESULT_SUMMARY: 275654697,      // text
  NOTES: 275654698,               // text
} as const;

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

  // CCO-T006: server-side enforcement (layer 3 of 3). Catalog UX and the
  // /exam/start redirect can be bypassed by hitting this server action
  // directly (e.g. a non-subscriber who knows a test_id). This guard is the
  // integrity boundary — without it, the UI gates are advisory only.
  const [contactRow] = await db
    .select({
      subscriptionStatus: contacts.subscriptionStatus,
      enrolledTrackerTypes: contacts.enrolledTrackerTypes,
    })
    .from(contacts)
    .where(eq(contacts.podioItemId, session.contactId))
    .limit(1);
  const decision = canAccessTest(test, {
    subscriptionStatus: contactRow?.subscriptionStatus ?? null,
    enrolledTrackerTypes: contactRow?.enrolledTrackerTypes ?? null,
  });
  if (decision === "members_only") {
    return {
      error:
        "This exam is available to CCO Club members only. Visit /upgrade to learn more.",
    };
  }

  // Load questions. Prefer a live Podio sync (freshest), but NEVER let a Podio
  // failure become a hard 500 — that was the 2026-06-24 outage (CCO-T065): a
  // Podio HTTP 420 rate-limit threw straight out of this uncaught
  // syncQuestionsForTest call, so /exam/start returned a blank Vercel error
  // page. Every sibling route (catalog, sign-in, gradebook, exam/take) already
  // falls back to the Neon mirror; exam-start now does too.
  let questionList: Awaited<ReturnType<typeof syncQuestionsForTest>>;
  let usedMirrorFallback = false;
  try {
    questionList = await syncQuestionsForTest(testPodioId);
  } catch (err) {
    usedMirrorFallback = true;
    console.error(
      `CCO-T065: live question sync failed for test ${testPodioId}; falling back to the Neon mirror:`,
      err
    );
    questionList = await getMirroredQuestionsForTest(testPodioId).catch(
      (mirrorErr) => {
        console.error(
          `CCO-T065: Neon mirror fallback also failed for test ${testPodioId}:`,
          mirrorErr
        );
        return [];
      }
    );
  }

  if (!questionList.length) {
    // No questions to serve. Distinguish the two causes: a degraded Podio with
    // an empty mirror is transient (ask the student to retry); a genuinely
    // empty test is a content/config issue (the original message).
    return {
      error: usedMirrorFallback
        ? "The exam couldn't load due to high demand — please try again in a minute."
        : "No questions available for this test",
    };
  }

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
  scratchPad: string,
  highlights?: Record<number, string>,
  paneWidth?: number
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

  const update: Record<string, unknown> = { timeRemainingSeconds, scratchPad };
  if (highlights !== undefined) {
    update.highlights = highlights as unknown;
  }
  if (paneWidth !== undefined) {
    update.paneWidth = String(paneWidth);
  }

  await db.update(attempts).set(update).where(eq(attempts.id, attemptId));
}

// ---------------------------------------------------------------------------
// CCO-T068: per-question feedback — student reports a problem with a question.
// Distinct from the personal Flag-for-review (answers.flagged, untouched).
// Resilient write-through: capture to Neon first (durable), then best-effort
// mirror to the dedicated "CCO Question Feedback" Podio app (30767002). A Podio
// failure keeps the Neon row + logs (recoverable) and never hard-fails the
// student — mirrors submitExamAction's Promise.allSettled resilience.
// Ownership-guarded exactly like saveAnswerAction (attempt.contactId === session).
// No exam answer/score/gating state is touched.
// ---------------------------------------------------------------------------

export async function submitQuestionFeedbackAction(input: {
  attemptId: number;
  questionPodioId: number;
  comment: string;
  difficulty?: string | null;
  issueType?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Please sign in to send feedback." };

  const attemptId = Number(input.attemptId);
  const questionPodioId = Number(input.questionPodioId);
  if (!Number.isFinite(attemptId) || !Number.isFinite(questionPodioId)) {
    return { error: "Invalid request." };
  }

  // Ownership guard — same boundary as saveAnswerAction/saveExamStateAction.
  const [attempt] = await db
    .select({
      contactId: attempts.contactId,
      testPodioId: attempts.testPodioId,
    })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.contactId !== session.contactId) {
    return { error: "We couldn't find that exam attempt." };
  }

  // Validate / normalize.
  const comment = (input.comment ?? "").trim().slice(0, FEEDBACK_COMMENT_MAX);
  const difficulty = isFeedbackDifficulty(input.difficulty)
    ? input.difficulty
    : null;
  const issueType = isFeedbackIssueType(input.issueType) ? input.issueType : null;
  // CCO-T081: a one-tap difficulty rating submits with no comment, so require at
  // least ONE meaningful signal (comment, difficulty, or issue type) instead of
  // forcing a comment. The write contract is otherwise unchanged — same Neon
  // columns, same Podio app/fields, same resilience + ownership guard.
  if (!comment && !difficulty && !issueType) {
    return { error: "Add a note or pick a rating so we know what you mean 🙂" };
  }

  // 1) Durable capture to Neon (the source of truth for recovery).
  let feedbackRowId: number | null = null;
  try {
    const [row] = await db
      .insert(feedback)
      .values({
        attemptId,
        questionPodioId,
        comment: comment || null, // CCO-T081: null (not "") for a rating-only submit
        difficultyRating: difficulty,
        issueType,
        contactId: session.contactId,
      })
      .returning({ id: feedback.id });
    feedbackRowId = row?.id ?? null;
  } catch (err) {
    console.error("CCO-T068: failed to persist feedback to Neon:", err);
    return { error: "Couldn't send feedback right now — please try again." };
  }

  // Resolve the reporter's name for the Podio item (best-effort).
  let studentName: string | null = null;
  try {
    const [contact] = await db
      .select({ fullName: contacts.fullName })
      .from(contacts)
      .where(eq(contacts.podioItemId, session.contactId))
      .limit(1);
    studentName = contact?.fullName ?? null;
  } catch {
    /* non-fatal — Podio item just omits the name */
  }

  // 2) Best-effort Podio mirror. Failures keep the Neon row + log only.
  try {
    const fields: Record<string, unknown> = {
      [QUESTION_FEEDBACK_FIELDS.QUESTION]: [questionPodioId], // app-ref → QB item
      [QUESTION_FEEDBACK_FIELDS.QUESTION_ITEM_ID]: questionPodioId,
      [QUESTION_FEEDBACK_FIELDS.ATTEMPT_ID]: attemptId,
      [QUESTION_FEEDBACK_FIELDS.CONTACT_ID]: session.contactId,
      [QUESTION_FEEDBACK_FIELDS.STATUS]: QUESTION_FEEDBACK_OPTIONS.STATUS_NEW,
      [QUESTION_FEEDBACK_FIELDS.SOURCE]: "CCO Portal",
    };
    // CCO-T081: omit the comment field entirely for a rating-only submit
    // (rather than writing an empty string into the Podio triage app).
    if (comment) fields[QUESTION_FEEDBACK_FIELDS.COMMENT] = comment;
    if (attempt.testPodioId) {
      fields[QUESTION_FEEDBACK_FIELDS.TEST] = [Number(attempt.testPodioId)];
    }
    if (studentName) fields[QUESTION_FEEDBACK_FIELDS.STUDENT] = studentName;
    if (difficulty) {
      fields[QUESTION_FEEDBACK_FIELDS.DIFFICULTY] =
        QUESTION_FEEDBACK_OPTIONS.DIFFICULTY[difficulty];
    }
    if (issueType) {
      fields[QUESTION_FEEDBACK_FIELDS.ISSUE_TYPE] =
        QUESTION_FEEDBACK_OPTIONS.ISSUE_TYPE[issueType];
    }

    const created = await createItem(PODIO_APPS.QUESTION_FEEDBACK, fields);
    if (feedbackRowId != null && created?.item_id) {
      await db
        .update(feedback)
        .set({ podioItemId: created.item_id })
        .where(eq(feedback.id, feedbackRowId));
    }
  } catch (err) {
    console.error(
      `CCO-T068: Podio feedback write failed (Neon row ${feedbackRowId} kept for recovery):`,
      err
    );
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Submit exam — calculates scores and marks complete
// ---------------------------------------------------------------------------

export async function submitExamAction(
  attemptId: number
): Promise<{ error?: string; redirectTo?: string }> {
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

  const submittedAt = new Date();

  await db
    .update(attempts)
    .set({
      status: "submitted",
      submittedAt,
      scorePercent: String(scorePercent),
      timeRemainingSeconds: 0,
    })
    .where(eq(attempts.id, attemptId));

  // Replicate to Podio BEFORE returning. These were previously fire-and-forget,
  // but Vercel suspends the serverless function the moment the action returns,
  // which killed the in-flight writes (T034 incident: attempt left unsynced even
  // though Podio reads worked). Awaiting in parallel makes them reliable; we
  // capture failures so a Podio outage still lets the student see results, and
  // scripts/backfill-test-results.mjs recovers anything left unsynced. Two
  // independent writes (CCO-T034 keeps both):
  //   1. Test Attempts (30626082) — the portal's richer per-question record.
  //   2. Test Results (16234798)  — the Zenforo-shape row that drives the
  //      gradebook "Past results" + Mary's progress-tracker automation.
  const [attemptsWrite, resultsWrite] = await Promise.allSettled([
    writAttemptToPodio(attempt, submittedAt, scorePercent, total, correct, session.contactId),
    writeResultToTestResultsApp(attempt, submittedAt, scorePercent, session.contactId),
  ]);
  if (attemptsWrite.status === "rejected")
    console.error("Podio Test Attempts write-back failed:", attemptsWrite.reason);
  if (resultsWrite.status === "rejected")
    console.error(
      "CCO-T034 Test Results write failed (left unsynced for backfill):",
      resultsWrite.reason
    );

  return { redirectTo: `/exam/results/${attemptId}` };
}

// ---------------------------------------------------------------------------
// Podio write-back — creates a Test Attempt item in Podio
// ---------------------------------------------------------------------------

async function writAttemptToPodio(
  attempt: { id: number; testPodioId: number; startedAt: Date | null; questionOrder: unknown; scratchPad: string | null },
  submittedAt: Date,
  scorePercent: number,
  totalQuestions: number,
  correctCount: number,
  contactId: number
): Promise<void> {
  // Get contact name
  const [contact] = await db
    .select({ fullName: contacts.fullName })
    .from(contacts)
    .where(eq(contacts.podioItemId, contactId))
    .limit(1);

  // Get test name
  const [test] = await db
    .select({ testName: tests.testName })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);

  const startedAt = attempt.startedAt ? new Date(attempt.startedAt) : submittedAt;
  const durationMinutes = Math.round(
    (submittedAt.getTime() - startedAt.getTime()) / 60000
  );

  const questionIds = (attempt.questionOrder as number[]) ?? [];

  // Podio requires "YYYY-MM-DD HH:MM:SS" — not ISO 8601
  const podioDate = (d: Date) =>
    d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  const fields: Record<string, unknown> = {
    [ATTEMPT_FIELDS.TEST]: [attempt.testPodioId],
    [ATTEMPT_FIELDS.STATUS]: 2, // "Completed" option ID (1=In Progress, 2=Completed, 3=Abandoned)
    [ATTEMPT_FIELDS.STARTED_AT]: {
      start: podioDate(startedAt),
    },
    [ATTEMPT_FIELDS.COMPLETED_AT]: {
      start: podioDate(submittedAt),
    },
    [ATTEMPT_FIELDS.CONTACT_ITEM_ID]: contactId,
    [ATTEMPT_FIELDS.DURATION_MINUTES]: durationMinutes,
    [ATTEMPT_FIELDS.SCORE]: scorePercent,
    [ATTEMPT_FIELDS.QUESTION_COUNT]: totalQuestions,
    [ATTEMPT_FIELDS.ATTEMPT_NAME]: `${test?.testName ?? "Exam"} — ${contact?.fullName ?? "Student"} — ${submittedAt.toLocaleDateString("en-US")}`,
    [ATTEMPT_FIELDS.CONTACT_NAME]: contact?.fullName || "Student",
    [ATTEMPT_FIELDS.RESULT_SUMMARY]: `Score: ${scorePercent}% (${correctCount}/${totalQuestions}). Duration: ${durationMinutes}m.`,
  };

  // Only add optional text fields if they have content (Podio rejects empty strings)
  const qIds = questionIds.join(",");
  if (qIds) fields[ATTEMPT_FIELDS.SERVED_QUESTION_IDS] = qIds;
  if (attempt.scratchPad) fields[ATTEMPT_FIELDS.NOTES] = attempt.scratchPad;

  const result = await createItem(30626082, fields);

  // Mark as synced in Neon
  await db
    .update(attempts)
    .set({ podioSynced: true })
    .where(eq(attempts.id, attempt.id));

  console.log("Podio write-back OK: item", result.item_id, "for attempt", attempt.id);
}

// ---------------------------------------------------------------------------
// CCO-T034: replicate the result into the Podio Test Results app (16234798) in
// the Zenforo shape, so the gradebook "Past results" + Mary's progress-tracker
// automation pick it up. The Test Results app's create-triggered ACTION chain
// resolves Contact (by email) + Test/PT (by name) itself — see
// `test-results-write.ts`. Podio-first: the Neon sync column is set only AFTER
// Podio confirms, so a Podio failure leaves it null + logged (recoverable by
// the backfill sweep) rather than silently dropping the result.
// ---------------------------------------------------------------------------

async function writeResultToTestResultsApp(
  attempt: {
    id: number;
    testPodioId: number;
    startedAt: Date | null;
    podioTestResultItemId: number | null;
  },
  submittedAt: Date,
  scorePercent: number,
  contactId: number
): Promise<void> {
  // Idempotent: never write a second Test Results row for the same attempt.
  if (attempt.podioTestResultItemId != null) return;

  const [contact] = await db
    .select({ email: contacts.email, fullName: contacts.fullName })
    .from(contacts)
    .where(eq(contacts.podioItemId, contactId))
    .limit(1);
  if (!contact?.email) {
    console.error(
      `CCO-T034: no email for contact ${contactId}; cannot write Test Results row for attempt ${attempt.id}`
    );
    return;
  }

  const [test] = await db
    .select({ testName: tests.testName })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);
  if (!test?.testName) {
    console.error(
      `CCO-T034: no test name for test ${attempt.testPodioId}; cannot write Test Results row for attempt ${attempt.id}`
    );
    return;
  }

  const startedAt = attempt.startedAt ? new Date(attempt.startedAt) : submittedAt;
  const durationSeconds = Math.max(
    0,
    Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)
  );

  // Best-effort: the Test's app_item_id (for test__test_id = "test{id}") isn't in
  // the Neon mirror, so fetch it from Podio. A failure must NOT block the result
  // write — test__test_id is just left blank in that case.
  let testAppItemId: number | null = null;
  try {
    testAppItemId = (await getItem(attempt.testPodioId)).app_item_id ?? null;
  } catch (err) {
    console.error(
      `CCO-T034: could not fetch app_item_id for test ${attempt.testPodioId} (test__test_id left blank):`,
      err
    );
  }

  const itemId = await writeTestResultToPodio({
    contactEmail: contact.email,
    contactFullName: contact.fullName ?? null,
    testPodioId: attempt.testPodioId,
    testName: test.testName,
    testAppItemId,
    scorePercent,
    durationSeconds,
    completedAt: submittedAt,
    attemptId: attempt.id,
  });

  // Podio confirmed — now (and only now) mark the attempt as replicated.
  await db
    .update(attempts)
    .set({ podioTestResultItemId: itemId })
    .where(eq(attempts.id, attempt.id));

  console.log(
    `CCO-T034: Test Results item ${itemId} created for attempt ${attempt.id}`
  );
}
