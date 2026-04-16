"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  // SSO flows redirect here with ?return_to=/api/sso/authorize?...
  // after which loginAction sends the user back to complete the OAuth dance.
  const returnTo = useSearchParams().get("return_to") ?? "";

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl font-bold text-cco-ink">
            CCO Test Platform
          </h1>
          <p className="text-cco-muted mt-2">
            Sign in to access your exams
          </p>
        </div>

        <form
          action={formAction}
          className="bg-white border border-cco-border rounded-2xl shadow-sm p-6 space-y-4"
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
            {pending ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
