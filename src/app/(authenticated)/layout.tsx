import { redirect } from "next/navigation";
import { getSessionContact } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { ExamGuardProvider } from "@/components/exam/ExamGuard";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionContact();
  if (!user) redirect("/sign-in");

  // ExamGuardProvider wraps both the nav and the page so TopBar's same-tab
  // links can confirm-before-leaving while an exam is in progress (CCO-T075).
  return (
    <ExamGuardProvider>
      <TopBar userName={user.fullName ?? user.email} userEmail={user.email} />
      <main className="flex-1 w-full max-w-[calc(100vw-clamp(32px,4vw,48px))] mx-auto px-[clamp(16px,2vw,24px)] py-8">
        {children}
      </main>
    </ExamGuardProvider>
  );
}
