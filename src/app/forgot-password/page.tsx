"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/actions/password-reset";
import { Logo } from "@/components/shared/Logo";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    null
  );

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12 relative overflow-hidden">
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

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <Logo size="lg" variant="stacked" href={null} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cco-purple font-semibold">
            Reset your password
          </p>
        </div>

        {state?.sent ? (
          <div className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-4">
            <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
              Check your email
            </h2>
            <p className="text-sm text-cco-muted leading-relaxed">
              If an account exists for that email, we&rsquo;ve sent a link to
              reset your password. The link expires in 30 minutes. Be sure to
              check your spam folder if you don&rsquo;t see it.
            </p>
            <p className="text-sm text-cco-muted leading-relaxed">
              <Link
                href="/sign-in"
                className="font-semibold text-cco-purple hover:underline"
              >
                ← Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form
            action={formAction}
            className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-5"
          >
            <div>
              <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
                Forgot your password?
              </h2>
              <p className="text-sm text-cco-muted mt-1">
                Enter the email you use for CCO and we&rsquo;ll send you a
                reset link.
              </p>
            </div>

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

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-cco-purple text-white font-semibold rounded-full py-3 transition hover:bg-cco-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-sm text-center text-cco-muted">
              <Link
                href="/sign-in"
                className="font-semibold text-cco-purple hover:underline"
              >
                ← Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
