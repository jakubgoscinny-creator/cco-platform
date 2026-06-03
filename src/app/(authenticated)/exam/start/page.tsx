import { db } from "@/lib/db";
import { tests, ceuItems } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card } from "@/components/shared/Card";
import { Clock, FileText, Target, ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { StartExamButton } from "@/components/exam/StartExamButton";
import { CeuExpirationBanner } from "@/components/exam/CeuExpirationBanner";
import { getSessionContact } from "@/lib/auth";
import { canAccessTest } from "@/lib/circle-access";

export default async function ExamStartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const testId = typeof params?.test_id === "string" ? Number(params.test_id) : 0;

  if (!testId) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cco-purple/10 text-cco-purple mb-5">
          <BookOpen size={26} />
        </span>
        <h1 className="font-heading text-2xl font-bold text-cco-ink mb-3">
          Start an exam
        </h1>
        <p className="text-cco-muted mb-6">
          Select an exam from the catalog to begin.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600 hover:-translate-y-px hover:shadow-md"
        >
          Browse catalog
        </Link>
      </div>
    );
  }

  const [test] = await db
    .select()
    .from(tests)
    .where(eq(tests.podioItemId, testId))
    .limit(1);

  if (!test) redirect("/catalog");

  // CCO-T006: block Member-tier tests for non-subscribers. Redirect to the
  // upgrade page rather than rendering the start UI; cleaner than a mid-page
  // "Members only" block since the catalog already showed the lock badge.
  // This is layer 2 of 3 (catalog UX is layer 1; attempt-create server
  // action enforcement is layer 3 — the integrity boundary).
  const contact = await getSessionContact();
  if (
    canAccessTest(test, {
      subscriptionStatus: contact?.subscriptionStatus ?? null,
      enrolledTrackerTypes: contact?.enrolledTrackerTypes ?? null,
    }) === "members_only"
  ) {
    redirect(`/upgrade?test_id=${testId}`);
  }

  // CEU expiration: surface the earliest (most restrictive) expiration date
  // across all CEU items linked to this test.
  let earliestCeuExpiration: Date | null = null;
  if (test.ceuItemIds && test.ceuItemIds.length > 0) {
    const ceuRows = await db
      .select({ dateExpires: ceuItems.dateExpires })
      .from(ceuItems)
      .where(inArray(ceuItems.podioItemId, test.ceuItemIds));
    const expirations = ceuRows
      .map((r) => r.dateExpires)
      .filter((d): d is Date => d != null);
    if (expirations.length > 0) {
      earliestCeuExpiration = new Date(
        Math.min(...expirations.map((d) => new Date(d).getTime()))
      );
    }
  }

  const hasTimeLimit = test.timeLimitMinutes != null && test.timeLimitMinutes > 0;
  const hasPassing = test.passingScore != null && test.passingScore > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-cco-muted no-underline hover:text-cco-purple transition mb-5"
      >
        <ArrowLeft size={14} />
        Back to catalog
      </Link>

      {/* Bold gradient hero — mirrors the catalog section headers */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cco-purple to-cco-purple-700 text-white p-6 sm:p-7 shadow-[0_10px_28px_rgba(129,84,129,0.22)]">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <FileText size={22} />
          </span>
          <div className="min-w-0 flex-1">
            {test.testType && (
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/75 mb-1">
                {test.testType}
              </p>
            )}
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold leading-tight">
              {test.testName}
            </h1>
          </div>
        </div>

        {(test.questionCount != null || hasTimeLimit || hasPassing) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {test.questionCount != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <FileText size={13} />
                {test.questionCount} questions
              </span>
            )}
            {hasTimeLimit && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Clock size={13} />
                {test.timeLimitMinutes} minutes
              </span>
            )}
            {hasPassing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Target size={13} />
                Pass at {test.passingScore}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <Card className="mt-4 space-y-5">
        {test.description && (
          <p className="text-sm text-cco-muted leading-relaxed">
            {stripHtml(test.description)}
          </p>
        )}

        {earliestCeuExpiration && (
          <CeuExpirationBanner earliestExpiration={earliestCeuExpiration} />
        )}

        <div className="bg-cco-bg-soft rounded-xl p-4 text-sm text-cco-muted space-y-2">
          <p className="font-semibold text-cco-ink">Before you begin:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your progress is saved automatically as you answer each question</li>
            <li>You can flag questions to review later</li>
            <li>Use the scratch pad for notes during the exam</li>
            {hasTimeLimit && (
              <li>The timer will count down from {test.timeLimitMinutes} minutes</li>
            )}
          </ul>
        </div>

        <StartExamButton testPodioId={testId} />
      </Card>
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
