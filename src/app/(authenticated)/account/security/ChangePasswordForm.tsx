"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/actions/change-password";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    null
  );

  // On success, reset the form so a second change is starting from
  // a clean slate (and the just-entered current/new password aren't
  // sitting in DOM history).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.done) formRef.current?.reset();
  }, [state?.done]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-5"
    >
      {state?.done && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
          Password updated. The next time you sign in, use your new password.
        </div>
      )}

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="current"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
        >
          Current password
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
        />
      </div>

      <div>
        <label
          htmlFor="next"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
        >
          New password
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
        />
        <p className="mt-1.5 text-xs text-cco-muted">
          At least 8 characters. We&rsquo;ll reject passwords that appear
          in known data breaches.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cco-purple text-white font-semibold rounded-full py-3 transition hover:bg-cco-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
