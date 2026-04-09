import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";

export function TopBar({ userName }: { userName?: string | null }) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 border-b border-cco-border backdrop-blur-md">
      <nav className="w-full max-w-[calc(100vw-clamp(32px,4vw,48px))] mx-auto px-[clamp(16px,2vw,24px)] py-3.5 flex items-center justify-between gap-4">
        <Link
          href="/catalog"
          className="font-heading font-bold tracking-tight text-cco-ink no-underline"
        >
          CCO Test Platform
        </Link>

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
            <form action={logoutAction} className="flex items-center">
              <span className="text-sm text-cco-muted mr-2 hidden sm:inline">
                {userName}
              </span>
              <button
                type="submit"
                className="p-2 rounded-full text-cco-muted hover:bg-cco-bg-soft hover:text-cco-purple transition"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </form>
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
      className="text-cco-muted font-semibold px-2.5 py-1.5 rounded-full no-underline transition hover:bg-cco-bg-soft hover:text-cco-purple"
    >
      {children}
    </Link>
  );
}
