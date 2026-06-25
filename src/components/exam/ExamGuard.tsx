"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

/**
 * CCO-T075: confirm-before-leaving during an active exam.
 *
 * The TopBar nav (Catalog / Gradebook / account links) lives in the
 * authenticated layout, above the exam page, so it can't read exam state
 * directly. This tiny context bridges them: ExamClient marks the attempt
 * active while it's in progress, and same-tab nav links route their clicks
 * through `requestLeave()`. If an exam is active the navigation is intercepted
 * and a confirm modal is shown (progress auto-saves regardless, so it's a
 * guard against *accidental* navigation, not a lock). The Academy button opens
 * a new tab and never leaves the page, so it is deliberately NOT guarded.
 *
 * `examActive` is held in a ref so marking it does not re-render the tree.
 */
interface ExamGuardValue {
  setExamActive: (active: boolean) => void;
  /** Returns true if navigation may proceed now; false if it was intercepted (modal shown). */
  requestLeave: (href: string) => boolean;
}

const ExamGuardContext = createContext<ExamGuardValue | null>(null);

export function ExamGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const examActiveRef = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setExamActive = useCallback((active: boolean) => {
    examActiveRef.current = active;
  }, []);

  const requestLeave = useCallback((href: string) => {
    if (!examActiveRef.current) return true;
    setPendingHref(href);
    return false;
  }, []);

  const confirmLeave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }, [pendingHref, router]);

  // Stable identity so consumer effects (ExamClient's active-marking) don't churn.
  const value = useMemo(
    () => ({ setExamActive, requestLeave }),
    [setExamActive, requestLeave]
  );

  return (
    <ExamGuardContext.Provider value={value}>
      {children}
      {pendingHref && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cco-gold/15 text-cco-gold-dark">
                <AlertTriangle size={18} />
              </span>
              <h3 className="font-heading font-bold text-lg text-cco-ink">
                Leave your exam?
              </h3>
            </div>
            <p className="text-sm text-cco-muted">
              Your progress is saved automatically — you can come back and pick
              up where you left off. Leave this page now?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingHref(null)}
                className="flex-1 px-4 py-2.5 rounded-full border border-cco-border text-cco-muted font-semibold text-sm transition hover:bg-cco-bg-soft"
              >
                Stay in exam
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 px-4 py-2.5 rounded-full bg-cco-purple text-white font-semibold text-sm transition hover:bg-cco-purple-600"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </ExamGuardContext.Provider>
  );
}

/**
 * Consume the guard. Returns a no-op fallback when rendered outside a provider
 * (e.g. sign-in surfaces don't mount it), so callers never need a null check.
 */
export function useExamGuard(): ExamGuardValue {
  return (
    useContext(ExamGuardContext) ?? {
      setExamActive: () => {},
      requestLeave: () => true,
    }
  );
}
