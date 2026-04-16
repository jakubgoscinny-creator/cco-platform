"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { Logo } from "@/components/shared/Logo";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  // SSO flows redirect here with ?return_to=/api/sso/authorize?...
  const returnTo = useSearchParams().get("return_to") ?? "";

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient brand glows — soft, non-clickable */}
      <div
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "#815481" }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "#89bd40" }}
      />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Logo size="lg" showTagline href={null} />
          </div>
          <p className="text-cco-muted mt-4 text-sm">
            Welcome back. Sign in to pick up where you left off.
          </p>
        </div>

        <form
          action={formAction}
          className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-6 space-y-4"
        >
          <input type="hidden" name="return_to" value={returnTo} />
          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-cco-ink mb-1.5"
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
              className="block text-sm font-semibold text-cco-ink mb-1.5"
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
            className="w-full bg-cco-purple text-white font-semibold rounded-full py-2.5 transition hover:bg-cco-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Signing you in…" : "Sign in"}
          </button>
        </form>

        {/* Laureen quote — small, warm, signed */}
        <div className="mt-8 text-center px-4">
          <p className="text-sm text-cco-ink/80 italic leading-relaxed">
            &ldquo;You showed up. That&rsquo;s already half the battle. Let&rsquo;s
            get you certified.&rdquo;
          </p>
          <p className="mt-2 text-xs text-cco-muted">
            — Laureen Jandroep, CPC, COC, CPC-I · Founder, CCO
          </p>
        </div>
      </div>
    </div>
  );
}
