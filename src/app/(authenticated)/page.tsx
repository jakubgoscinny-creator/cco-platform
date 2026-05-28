/**
 * CCO-T032: Post-login destination chooser.
 *
 * The portal sign-in is the canonical entry for all CCO surfaces. After
 * signing in, the user lands here and picks where to go:
 *
 *   - Academy → Circle (community/coaching). Same tab — the user's
 *     existing Circle session cookie handles auth on the Circle side.
 *     No portal-side outbound SSO required; the signer is inbound only.
 *   - Exams   → /catalog (this app).
 *   - Textbooks → hidden until CCO-T011 ships.
 *
 * Per Laureen at Fathom 146375635 @53:14: "everyone goes to the portal
 * page. And then on the top, it's like, log into the academy or take
 * a test or take an exam portal."
 */

import Link from "next/link";
import { ArrowUpRight, BookOpen, GraduationCap } from "lucide-react";
import { getSessionContact } from "@/lib/auth";
import { PageHeader, firstName, timeOfDayGreeting } from "@/components/shared/PageHeader";

// Circle's SSO-initiate URL (NOT the bare homepage). The chooser is only
// reached with a live portal session, so hitting Circle's initiate kicks
// off the OAuth dance against the portal (/api/sso/authorize), which sees
// the session and signs the user straight into Circle — no second login.
// A bare cco.academy link instead drops a session-less visitor on Circle's
// logged-out homepage (the bug Jakub caught in a clean window 2026-05-28).
// If the user already has a Circle session, the dance completes instantly.
const ACADEMY_URL = "https://www.cco.academy/oauth2/initiate";

export default async function ChooserPage() {
  const user = await getSessionContact();
  const greet = user?.fullName ? firstName(user.fullName) : null;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="CCO Academy"
        title={greet ? `${timeOfDayGreeting()}, ${greet}` : "Welcome back"}
        subtitle="Pick where you'd like to go. You can come back here any time."
        gradient
      />

      <div className="grid gap-5 md:grid-cols-2">
        <DestinationCard
          href={ACADEMY_URL}
          external
          accent="purple"
          icon={<GraduationCap size={26} strokeWidth={1.5} />}
          eyebrow="Coaching · Community"
          title="CCO Academy"
          description="Live coaching, community discussions, and your CCO Club lessons."
          cta="Go to Academy"
        />
        <DestinationCard
          href="/catalog"
          accent="green"
          icon={<BookOpen size={26} strokeWidth={1.5} />}
          eyebrow="CEU · Practice exams"
          title="Exam Portal"
          description="Take a CEU quiz, sit a mock certification exam, or review your gradebook."
          cta="Open Catalog"
        />
      </div>
    </div>
  );
}

function DestinationCard({
  href,
  external = false,
  accent,
  icon,
  eyebrow,
  title,
  description,
  cta,
}: {
  href: string;
  external?: boolean;
  accent: "purple" | "green";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
}) {
  // Accent classes per side so the two cards read as a pair without
  // duplicating brand colors on a single card.
  const accentBg = accent === "purple" ? "bg-cco-purple/10" : "bg-cco-green/10";
  const accentText =
    accent === "purple" ? "text-cco-purple" : "text-[#5d8a23]";
  const accentSpine =
    accent === "purple" ? "bg-cco-purple" : "bg-cco-green";

  const content = (
    <>
      <div
        className={`absolute inset-y-0 left-0 w-[3px] ${accentSpine}`}
        aria-hidden
      />
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-2xl ${accentBg} ${accentText} flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] uppercase tracking-[0.18em] ${accentText} font-semibold mb-1`}
          >
            {eyebrow}
          </p>
          <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
            {title}
          </h2>
          <p className="text-cco-muted text-[14px] mt-2 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accentText}`}
        >
          {cta}
          <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </>
  );

  const baseClasses =
    "group relative block bg-white border border-cco-border rounded-2xl px-6 py-7 pl-7 no-underline transition hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-cco-ink/15 overflow-hidden";

  if (external) {
    return (
      <a
        href={href}
        className={baseClasses}
        // No target="_blank": Laureen wants Academy to take over the tab
        // so the chooser doesn't accumulate as background tabs.
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={baseClasses}>
      {content}
    </Link>
  );
}
