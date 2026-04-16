import { db } from "@/lib/db";
import { attempts, answers, tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Download,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { QuestionSnapshot } from "@/lib/exam-engine";
import {
  issueCertificate,
  getCertificatesForAttempt,
} from "@/lib/certificate";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResultsReview, type ResultQuestion } from "@/components/results/ResultsReview";

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
    .select({
      testName: tests.testName,
      passingScore: tests.passingScore,
      ceuItemIds: tests.ceuItemIds,
    })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);

  const allAnswers = await db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, attemptId));
  const answerMap = new Map(allAnswers.map((a) => [a.questionPodioId, a]));

  const snapshots = (attempt.questionSnapshots ?? []) as QuestionSnapshot[];
  const snapshotMap = new Map(snapshots.map((s) => [s.podioItemId, s]));

  const score = attempt.scorePercent ? Number(attempt.scorePercent) : 0;
  const passingThreshold = test?.passingScore ?? 70;
  const passed = score >= passingThreshold;

  // Issue certificates if passing and test has CEU items (idempotent)
  const hasCeu = (test?.ceuItemIds ?? []).length > 0;
  if (passed && hasCeu) {
    await issueCertificate(attemptId, session.contactId).catch((err) =>
      console.error("Certificate issuance failed:", err)
    );
  }
  const certs = hasCeu ? await getCertificatesForAttempt(attemptId) : [];

  const correct = allAnswers.filter((a) => a.isCorrect === true).length;
  const incorrect = allAnswers.filter((a) => a.isCorrect === false).length;
  const flaggedCount = allAnswers.filter((a) => a.flagged === true).length;

  const timeTaken =
    attempt.startedAt && attempt.submittedAt
      ? Math.round(
          (new Date(attempt.submittedAt).getTime() -
            new Date(attempt.startedAt).getTime()) /
            60000
        )
      : null;

  const questionOrder = (attempt.questionOrder as number[]) ?? [];
  const reviewQuestions: ResultQuestion[] = questionOrder
    .map((qId) => {
      const snap = snapshotMap.get(qId);
      if (!snap) return null;
      const ans = answerMap.get(qId);
      return {
        podioItemId: qId,
        questionText: snap.questionText,
        options: snap.options,
        correctKey: snap.correctKey,
        rationale: snap.rationale ?? null,
        selectedKey: ans?.selectedKey ?? null,
        isCorrect: ans?.isCorrect ?? null,
        flagged: ans?.flagged ?? false,
      };
    })
    .filter((q): q is ResultQuestion => q !== null);

  const completedOn = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <Link
        href="/gradebook"
        className="inline-flex items-center gap-1.5 text-sm text-cco-muted no-underline hover:text-cco-purple transition mb-4"
      >
        <ArrowLeft size={14} />
        Back to Gradebook
      </Link>

      <PageHeader
        gradient
        eyebrow={passed ? "You passed · well done" : "Exam results"}
        title={test?.testName ?? "Your Results"}
        subtitle={
          passed
            ? `Finished on ${completedOn}. Nice work — your certificate${
                certs.length > 1 ? "s are" : " is"
              } ready below.`
            : `Finished on ${completedOn}. Review your answers and try again when you're ready.`
        }
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Score"
          value={`${score}%`}
          color={passed ? "green" : "red"}
          sublabel={`Pass mark ${passingThreshold}%`}
        />
        <StatTile
          label="Correct"
          value={`${correct} / ${reviewQuestions.length}`}
          sublabel={
            incorrect > 0
              ? `${incorrect} incorrect`
              : correct === reviewQuestions.length
                ? "Perfect"
                : undefined
          }
        />
        <StatTile
          label="Duration"
          value={timeTaken != null ? formatDuration(timeTaken) : "--"}
          sublabel="Start to finish"
        />
        <StatTile
          label="Flagged"
          value={`${flaggedCount}`}
          sublabel={
            flaggedCount === 0 ? "None flagged" : "Marked for review"
          }
        />
      </div>

      {/* Certificates */}
      {certs.length > 0 && (
        <div className="mb-6 space-y-4">
          {certs
            .slice()
            .sort((a, b) => (a.type === "cco_credential" ? -1 : 1))
            .map((cert) => {
              const isAapc = cert.type === "aapc_ceu";
              return isAapc ? (
                <div
                  key={cert.id}
                  className="relative rounded-2xl bg-white border border-cco-border p-5 shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cco-green/10 flex items-center justify-center shrink-0">
                      <ShieldCheck size={24} className="text-cco-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cco-green-600">
                          Official AAPC
                        </p>
                        <span className="text-[10px] text-cco-muted">·</span>
                        <p className="text-[10px] text-cco-muted">
                          Submit to AAPC for CEU credit
                        </p>
                      </div>
                      <h3 className="font-heading text-base font-bold text-cco-ink">
                        AAPC CEU Certificate
                      </h3>
                      <p className="text-xs text-cco-muted mt-1 truncate">
                        {cert.eventTitle}
                        {cert.ceuValue ? ` · ${cert.ceuValue} CEU` : ""}
                        {cert.ceuIndexNumber
                          ? ` · Index: ${cert.ceuIndexNumber}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <a
                        href={`/api/certificate/${cert.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cco-green text-white text-sm font-semibold no-underline transition hover:bg-cco-green-600"
                        download
                      >
                        <Download size={14} />
                        Download
                      </a>
                      <p className="text-[9px] text-cco-muted font-mono tracking-wider">
                        {cert.verificationCode}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={cert.id}
                  className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-cco-purple via-[#6c3f6f] to-[#5f3c60] p-5 shadow-[0_10px_24px_rgba(129,84,129,0.25)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#fcb900] flex items-center justify-center border-2 border-[#e09b00] shrink-0">
                      <Sparkles size={26} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#fcb900] mb-0.5">
                        Certificate of Achievement · Signed by Laureen Jandroep
                      </p>
                      <h3 className="font-heading text-xl font-bold text-white">
                        CCO Certificate
                      </h3>
                      <p className="text-xs text-white/80 mt-1 truncate">
                        {cert.eventTitle} · Awarded to{" "}
                        <span className="font-semibold text-white">
                          {cert.studentName}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <a
                        href={`/api/certificate/${cert.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#fcb900] text-[#5f3c60] text-sm font-bold no-underline transition hover:bg-[#ffcc33]"
                        download
                      >
                        <Download size={14} />
                        Download
                      </a>
                      <p className="text-[9px] text-white/60 font-mono tracking-wider">
                        {cert.verificationCode}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-white/70 mt-3 pt-3 border-t border-white/10 leading-relaxed">
                    Your personal CCO credential — share on your CV, LinkedIn,
                    or frame it on your wall.
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Question review */}
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-heading text-xl font-bold text-cco-ink">
          Question Review
        </h2>
        <p className="text-xs text-cco-muted">
          Click any question to jump — rationale shown for every answer
        </p>
      </div>
      <ResultsReview
        questions={reviewQuestions}
        scratchPad={attempt.scratchPad}
      />

      <div className="mt-10 text-center">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600"
        >
          <FileText size={16} />
          Take another exam
        </Link>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sublabel,
  color = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: "default" | "green" | "red";
}) {
  const valueColor =
    color === "green"
      ? "text-cco-green-600"
      : color === "red"
        ? "text-red-600"
        : "text-cco-ink";

  return (
    <div className="bg-white border border-cco-border rounded-2xl p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
      <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-cco-muted mb-2">
        {label}
      </p>
      <p className={`font-heading text-3xl font-bold ${valueColor}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-[11px] text-cco-muted mt-1">{sublabel}</p>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
