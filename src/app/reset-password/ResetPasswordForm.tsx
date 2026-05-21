"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/actions/password-reset";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    null
  );

  return (
    <form
      action={formAction}
      className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-5"
    >
      <input type="hidden" name="token" value={token} />

      <div>
        <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
          Set a new password
        </h2>
        <p className="text-sm text-cco-muted mt-1">
          Choose something at least 8 characters long. You&rsquo;ll use it
          next time you sign in.
        </p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="password"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-cco-muted mb-1.5"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full bg-white text-cco-ink border border-cco-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
        />
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
