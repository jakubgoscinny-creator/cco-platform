import { db } from "@/lib/db";
import { tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card } from "@/components/shared/Card";
import { Pill } from "@/components/shared/Pill";
import { Clock, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StartExamButton } from "@/components/exam/StartExamButton";

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
        <h1 className="font-heading text-2xl font-bold text-cco-ink mb-4">
          Start Exam
        </h1>
        <p className="text-cco-muted mb-6">
          Select an exam from the catalog to begin.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600"
        >
          Browse Catalog
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

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-cco-muted no-underline hover:text-cco-purple transition mb-6"
      >
        <ArrowLeft size={14} />
        Back to Catalog
      </Link>

      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-xl font-bold text-cco-ink">
            {test.testName}
          </h1>
          {test.testType && (
            <Pill variant="purple">{test.testType}</Pill>
          )}
        </div>

        {test.description && (
          <p className="text-sm text-cco-muted">{stripHtml(test.description)}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-cco-muted border-t border-b border-cco-border py-4">
          {test.questionCount != null && (
            <span className="flex items-center gap-1.5">
              <FileText size={15} />
              {test.questionCount} questions
            </span>
          )}
          {test.timeLimitMinutes != null && test.timeLimitMinutes > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock size={15} />
              {test.timeLimitMinutes} minutes
            </span>
          )}
          {test.passingScore != null && test.passingScore > 0 && (
            <span className="flex items-center gap-1.5">
              Passing: {test.passingScore}%
            </span>
          )}
        </div>

        <div className="bg-cco-bg-soft rounded-xl p-4 text-sm text-cco-muted space-y-2">
          <p className="font-semibold text-cco-ink">Before you begin:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your progress is saved automatically as you answer each question</li>
            <li>You can flag questions to review later</li>
            <li>Use the scratch pad for notes during the exam</li>
            {test.timeLimitMinutes != null && test.timeLimitMinutes > 0 && (
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
