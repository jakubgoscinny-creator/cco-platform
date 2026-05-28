/**
 * CCO-T006: "Members only" upgrade page.
 *
 * Reached when a non-subscriber tries to start a Member-tier exam, either
 * via the catalog (where the locked CTA links here) or via the /exam/start
 * redirect (defense in depth). The server-side gate in
 * `startExamAction` returns an error to anyone who hits the action directly.
 *
 * Single CTA to the Circle signup. Per-paywall deep links are phase 2; for
 * now we direct everyone to the same upgrade flow.
 */

import { db } from "@/lib/db";
import { tests } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { Card } from "@/components/shared/Card";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Override-able via env so Laureen can change the upgrade destination without a deploy.
const UPGRADE_URL =
  process.env.NEXT_PUBLIC_CCO_UPGRADE_URL ?? "https://cco.us/club#price";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const testId =
    typeof params?.test_id === "string" ? Number(params.test_id) : 0;

  let testName: string | null = null;
  if (testId) {
    const [test] = await db
      .select({ testName: tests.testName })
      .from(tests)
      .where(eq(tests.podioItemId, testId))
      .limit(1);
    testName = test?.testName ?? null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-cco-muted no-underline hover:text-cco-purple transition mb-6"
      >
        <ArrowLeft size={14} />
        Back to Catalog
      </Link>

      <div className="rounded-xl border border-cco-border bg-cco-bg-soft px-4 py-3 text-sm text-cco-muted mb-4">
        If you recently joined, sign out and back in to refresh your access.
      </div>

      <Card className="space-y-6 text-center py-10 px-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-cco-purple/10 flex items-center justify-center">
          <Lock size={26} className="text-cco-purple" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-cco-ink">
            Members only
          </h1>
          <p className="text-cco-muted">
            {testName
              ? `"${testName}" is a CCO Club member exam.`
              : "This exam is reserved for CCO Club members."}
          </p>
        </div>

        <div className="bg-cco-bg-soft rounded-xl p-5 text-sm text-cco-ink/80 space-y-2 text-left">
          <p className="font-semibold text-cco-ink">As a CCO Club member you get:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Unlimited access to every CEU quiz on the portal</li>
            <li>AAPC-approved CEU certificates with each pass</li>
            <li>Coaching, community, and weekly office hours inside CCO Academy</li>
          </ul>
        </div>

        <a
          href={UPGRADE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-cco-gold text-cco-ink font-semibold no-underline transition hover:bg-cco-gold-dark hover:shadow-lg hover:-translate-y-px"
        >
          Join CCO Club
          <ArrowRight size={16} />
        </a>

        <p className="text-xs text-cco-muted pt-2">
          Already a member?{" "}
          <Link
            href="/sign-in"
            className="text-cco-purple underline-offset-2 hover:underline"
          >
            Sign in with the email on your subscription.
          </Link>
        </p>
      </Card>
    </div>
  );
}
