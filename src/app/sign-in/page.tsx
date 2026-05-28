"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { Logo } from "@/components/shared/Logo";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const params = useSearchParams();
  // SSO flows redirect here with ?return_to=/api/sso/authorize?...
  const returnTo = params.get("return_to") ?? "";
  // /reset-password redirects here with ?reset=done after a successful reset.
  const justReset = params.get("reset") === "done";

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Structural background: concentric rings that echo the round CC letterforms
       *  in the Academy mark. A single deliberate anchor, NOT an ambient gradient blob. */}
      <svg
        className="absolute -bottom-40 -right-40 w-[640px] h-[640px] opacity-[0.08] pointer-events-none"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle cx="50" cy="50" r="44" fill="none" stroke="#815481" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#815481" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="#89bd40" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="14" fill="none" stroke="#89bd40" strokeWidth="0.6" />
      </svg>
      <svg
        className="absolute -top-40 -left-40 w-[480px] h-[480px] opacity-[0.06] pointer-events-none"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="#89bd40" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#815481" strokeWidth="0.5" />
      </svg>

      <div className="w-full max-w-md relative">
        {/* Brand featured at top */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <Logo size="lg" variant="stacked" href={null} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cco-purple font-semibold">
            Medical Coding · CEU · Certification
          </p>
        </div>

        {/* Form */}
        <form
          action={formAction}
          className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-5"
        >
          <input type="hidden" name="return_to" value={returnTo} />

          <div>
            <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
              Welcome back
            </h2>
            <p className="text-sm text-cco-muted mt-1">
              Pick up where you left off.
            </p>
          </div>

          {justReset && !state?.error && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
              Password updated. Sign in with your new password to continue.
            </div>
          )}

          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-cco-purple text-white font-semibold rounded-full py-3 transition hover:bg-cco-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Signing you in…" : "Sign in"}
          </button>

          <p className="text-sm text-center text-cco-muted">
            <Link
              href="/forgot-password"
              className="font-semibold text-cco-purple hover:underline"
            >
              Forgot your password?
            </Link>
          </p>
        </form>

        {/* CCO-T032 (Option A): the portal is the OAuth identity provider, so
         *  email + password is the single front door. There is no "Sign in
         *  with Circle" login here — Circle is a *destination* reached from
         *  the post-login chooser (the Academy card → /oauth2/initiate logs
         *  the user into Circle via the portal). Circle-only members get a
         *  portal password via the reset-link launch comms (CCO-T031/T036).
         *  See docs/CIRCLE_SSO_SETUP.md for the reasoning. */}

        {/* Founder quote with gold rule above — inverts the usual cco-accent underline. */}
        <div className="mt-10 text-center px-4">
          <div className="mx-auto h-[3px] w-12 rounded-full bg-cco-gold" />
          <p className="text-sm text-cco-ink/80 italic leading-relaxed mt-5">
            &ldquo;You showed up. That&rsquo;s already half the battle. Let&rsquo;s
            get you certified.&rdquo;
          </p>
          <p className="mt-3 text-xs text-cco-muted">
            — Laureen Jandroep, CPC, COC, CPC-I · Founder, CCO
          </p>
        </div>
      </div>
    </div>
  );
}
