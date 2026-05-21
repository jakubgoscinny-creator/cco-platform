import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { verifyResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  // Server-side pre-flight: don't even render the form if the link is
  // obviously bad. The action re-verifies before writing, so this is
  // pure UX (skip the form, show a clear "request a new link" page).
  let tokenStatus: "ok" | "invalid" = "invalid";
  if (token) {
    try {
      await verifyResetToken(token);
      tokenStatus = "ok";
    } catch {
      tokenStatus = "invalid";
    }
  }

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
            Choose a new password
          </p>
        </div>

        {tokenStatus === "invalid" ? (
          <div className="bg-white border border-cco-border rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.06)] p-7 space-y-4">
            <h2 className="font-heading text-xl font-bold text-cco-ink leading-tight">
              This link is no longer valid
            </h2>
            <p className="text-sm text-cco-muted leading-relaxed">
              Password-reset links expire after 30 minutes and can only be
              used once. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full text-center bg-cco-purple text-white font-semibold rounded-full py-3 transition hover:bg-cco-purple-600 hover:shadow-lg"
            >
              Request a new link
            </Link>
            <p className="text-sm text-center text-cco-muted">
              <Link
                href="/sign-in"
                className="font-semibold text-cco-purple hover:underline"
              >
                ← Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <ResetPasswordForm token={token!} />
        )}
      </div>
    </div>
  );
}
