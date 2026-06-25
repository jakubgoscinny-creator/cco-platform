"use client";

import Link from "next/link";
import { GraduationCap, LogOut, Menu, Shield, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/shared/Logo";
import { ACADEMY_URL } from "@/lib/links";
import { useExamGuard } from "@/components/exam/ExamGuard";

export function TopBar({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const initials = getInitials(userName ?? "");
  const accountRef = useRef<HTMLDivElement>(null);
  const guard = useExamGuard();

  // Same-tab nav during an active exam → confirm before leaving (CCO-T075).
  // (The Academy link opens a new tab, so it is intentionally not guarded.)
  const guardNav = (e: React.MouseEvent, href: string) => {
    if (!guard.requestLeave(href)) e.preventDefault();
  };

  // Click-outside + Escape closes the account dropdown.
  useEffect(() => {
    if (!accountOpen) return;

    function onMouseDown(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/85 border-b border-cco-border backdrop-blur-md">
      {/* hairline gold accent — subtle premium touch */}
      <div className="h-[2px] bg-gradient-to-r from-cco-purple via-[#fcb900] to-cco-green" />

      <nav className="w-full max-w-[calc(100vw-clamp(32px,4vw,48px))] mx-auto px-[clamp(16px,2vw,24px)] py-3 flex items-center justify-between gap-4">
        <Logo size="sm" />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2.5">
          <NavLink href="/gradebook" onClick={(e) => guardNav(e, "/gradebook")}>
            Gradebook
          </NavLink>
          <Link
            href="/catalog"
            onClick={(e) => guardNav(e, "/catalog")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-cco-purple text-white font-semibold no-underline transition hover:bg-cco-purple-600 hover:shadow-lg hover:-translate-y-px"
          >
            Catalog
          </Link>
          {/* Academy → Circle. New tab so a mid-exam student keeps their place
              (exam auto-saves regardless), so no leave-confirm needed. */}
          <a
            href={ACADEMY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cco-muted font-semibold px-3 py-1.5 rounded-full no-underline transition hover:bg-cco-bg-soft hover:text-cco-purple"
          >
            <GraduationCap size={16} />
            Academy
          </a>

          {userName && (
            <div
              ref={accountRef}
              className="relative flex items-center gap-2 ml-1 pl-3 border-l border-cco-border"
            >
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full p-0.5 transition hover:opacity-90 focus:outline-2 focus:outline-cco-purple/25"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
              >
                <span
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-cco-purple to-[#5f3c60] text-white flex items-center justify-center text-xs font-bold shadow-[0_2px_6px_rgba(129,84,129,0.25)]"
                  title={userName}
                >
                  {initials}
                </span>
                <span className="text-sm font-semibold text-cco-ink hidden lg:inline">
                  {firstName(userName)}
                </span>
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 bg-white border border-cco-border rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] py-1.5 animate-in fade-in slide-in-from-top-1"
                >
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wider text-cco-muted font-semibold">
                      Signed in as
                    </p>
                    <p className="font-semibold text-cco-ink mt-0.5 truncate text-sm">
                      {userName}
                    </p>
                    {userEmail && userEmail !== userName && (
                      <p className="text-xs text-cco-muted truncate mt-0.5">
                        {userEmail}
                      </p>
                    )}
                  </div>
                  <div className="h-px bg-cco-border mx-2" />
                  <Link
                    href="/account/security"
                    role="menuitem"
                    onClick={(e) => {
                      setAccountOpen(false);
                      guardNav(e, "/account/security");
                    }}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-cco-ink font-medium no-underline hover:bg-cco-bg-soft transition"
                  >
                    <Shield size={16} className="text-cco-muted" />
                    Account security
                  </Link>
                  <div className="h-px bg-cco-border mx-2" />
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 transition"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
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
            onClick={() => setNavOpen(!navOpen)}
            className="p-2 rounded-full text-cco-ink hover:bg-cco-bg-soft transition"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
          >
            {navOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {navOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-cco-ink/30 backdrop-blur-sm z-40"
            onClick={() => setNavOpen(false)}
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
                  {userEmail && userEmail !== userName && (
                    <p className="text-xs text-cco-muted truncate mt-0.5">
                      {userEmail}
                    </p>
                  )}
                </div>
              )}
              <div className="h-px bg-cco-border" />
              <MobileLink
                href="/catalog"
                onClick={(e) => {
                  guardNav(e, "/catalog");
                  setNavOpen(false);
                }}
              >
                Catalog
              </MobileLink>
              <MobileLink
                href="/gradebook"
                onClick={(e) => {
                  guardNav(e, "/gradebook");
                  setNavOpen(false);
                }}
              >
                Gradebook
              </MobileLink>
              {/* Academy → Circle, new tab (no leave-confirm — doesn't leave the page). */}
              <a
                href={ACADEMY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setNavOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-cco-ink font-semibold text-base no-underline hover:bg-cco-bg-soft transition"
              >
                <span className="inline-flex items-center gap-2">
                  <GraduationCap size={16} className="text-cco-muted" />
                  CCO Academy
                </span>
              </a>
              <div className="h-px bg-cco-border" />
              <MobileLink
                href="/account/security"
                onClick={(e) => {
                  guardNav(e, "/account/security");
                  setNavOpen(false);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Shield size={16} className="text-cco-muted" />
                  Account security
                </span>
              </MobileLink>
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
  onClick,
  children,
}: {
  href: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
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
  onClick: (e: React.MouseEvent) => void;
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
