"use client";

import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/shared/Logo";

export function TopBar({ userName }: { userName?: string | null }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(userName ?? "");

  return (
    <header className="sticky top-0 z-30 bg-white/85 border-b border-cco-border backdrop-blur-md">
      {/* hairline gold accent — subtle premium touch */}
      <div className="h-[2px] bg-gradient-to-r from-cco-purple via-[#fcb900] to-cco-green" />

      <nav className="w-full max-w-[calc(100vw-clamp(32px,4vw,48px))] mx-auto px-[clamp(16px,2vw,24px)] py-3 flex items-center justify-between gap-4">
        <Logo size="sm" />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2.5">
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
              <span className="text-sm font-semibold text-cco-ink hidden lg:inline">
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

        {/* Mobile: avatar + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {userName && (
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-cco-purple to-[#5f3c60] text-white flex items-center justify-center text-xs font-bold shadow-[0_2px_6px_rgba(129,84,129,0.25)]"
              title={userName}
            >
              {initials}
            </div>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-full text-cco-ink hover:bg-cco-bg-soft transition"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-cco-ink/30 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-white border-b border-cco-border shadow-xl animate-in slide-in-from-top-2">
            <div className="px-5 py-4 space-y-1">
              {userName && (
                <div className="px-3 py-2 text-sm">
                  <p className="text-[10px] uppercase tracking-wider text-cco-muted font-semibold">
                    Signed in as
                  </p>
                  <p className="font-semibold text-cco-ink mt-0.5 truncate">
                    {userName}
                  </p>
                </div>
              )}
              <div className="h-px bg-cco-border" />
              <MobileLink href="/catalog" onClick={() => setOpen(false)}>
                Catalog
              </MobileLink>
              <MobileLink href="/gradebook" onClick={() => setOpen(false)}>
                Gradebook
              </MobileLink>
              <MobileLink href="/exam/start" onClick={() => setOpen(false)}>
                Start exam
              </MobileLink>
              <div className="h-px bg-cco-border" />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-600 font-semibold text-sm hover:bg-red-50 transition"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
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

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2.5 rounded-xl text-cco-ink font-semibold text-base no-underline hover:bg-cco-bg-soft transition"
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
