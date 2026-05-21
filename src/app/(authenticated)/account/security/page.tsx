import { getSessionContact } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = {
  title: "Account security",
};

export default async function AccountSecurityPage() {
  const user = await getSessionContact();
  if (!user) redirect("/sign-in?return_to=/account/security");

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-cco-purple font-semibold">
          Account · Security
        </p>
        <h1 className="font-heading text-2xl font-bold text-cco-ink leading-tight mt-2">
          Change your password
        </h1>
        <p className="text-sm text-cco-muted mt-2">
          Signed in as <span className="font-medium text-cco-ink">{user.email}</span>.
          Enter your current password and a new one.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
