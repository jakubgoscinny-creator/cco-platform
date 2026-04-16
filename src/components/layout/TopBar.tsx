import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/shared/Logo";

export function TopBar({ userName }: { userName?: string | null }) {
  const initials = getInitials(userName ?? "");

  return (
    <header className="sticky top-0 z-20 bg-white/85 border-b border-cco-border backdrop-blur-md">
      {/* hairline gold accent — subtle premium touch */}
      <div className="h-[2px] bg-gradient-to-r from-cco-purple via-[#fcb900] to-cco-green" />

      <nav className="w-full max-w-[calc(100vw-clamp(32px,4vw,48px))] mx-auto px-[clamp(16px,2vw,24px)] py-3 flex items-center justify-between gap-4">
        <Logo size="sm" />

        <div className="flex items-center gap-2.5 flex-wrap">
          <NavLink href="/catalog">Catalog</NavLink>
          <NavLink href="/gradebook">Gradebook</NavLink>
          <Link
            href="/exam/start"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600 hover:shadow-lg hover:-translate-y-px"
          >
            Start Exam
          </Link>

          {userName && (
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-cco-border">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-cco-purple to-[#5f3c60] text-white flex items-center justify-center text-xs font-bold shadow-[0_2px_6px_rgba(129,84,129,0.25)]"
                title={userName}
              >
                {initials}
              </div>
              <span className="text-sm font-semibold text-cco-ink hidden md:inline">
                {firstName(userName)}
              </span>
              <form action={logoutAction} className="flex items-center">
                <button
                  type="submit"
                  className="p-2 rounded-full text-cco-muted hover:bg-cco-bg-soft hover:text-cco-purple transition"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-cco-muted font-semibold px-3 py-1.5 rounded-full no-underline transition hover:bg-cco-bg-soft hover:text-cco-purple"
    >
      {children}
    </Link>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
