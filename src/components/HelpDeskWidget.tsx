"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * CCO help-desk AI chat widget loader.
 *
 * Surface (see AuthenticatedLayout wiring): renders on all authenticated
 * portal pages EXCEPT the active exam-taking view (/exam/take/[attemptId]).
 * It is intentionally NOT mounted on logged-out pages (sign-in, forgot-
 * password, reset-password) — those live outside the (authenticated) route
 * group, have no signed-in identity, and deliberately carry no widget. If the
 * product later wants help-desk chat on those pages, mount <HelpDeskWidget />
 * (it already supports null identity) in their layout; do not assume it is
 * present there today.
 *
 * The widget is a public, client-side chat: nothing secret is passed to it.
 * The only identity it receives is the signed-in contact's name + email, and
 * only in response to an explicit, same-origin handshake from the trusted
 * help-desk iframe (see the message listener).
 *
 * Anti-cheat: when the user enters the active exam view (including via a
 * client-side soft navigation from another authenticated page where the
 * widget is already mounted), the widget DOM is actively hidden — not merely
 * left in place with the identity handshake refused. See `setWidgetHidden`.
 */

// Channel identifier the loader script tags this embed with. Single source of
// truth so the data-attribute and the identity reply stay in sync.
export const PORTAL_HELPDESK_CHANNEL = "portal";

// Public help-desk app. The loader script is served from here and the chat
// iframe runs on this origin — identity replies are scoped to it ONLY.
const HELPDESK_ORIGIN = "https://cco-helpdesk.vercel.app";
const LOADER_URL = `${HELPDESK_ORIGIN}/embed.js`;
const IFRAME_ORIGIN = HELPDESK_ORIGIN;

// The floating chat button the loader injects (verified live on cco.us). Its id
// does NOT share the "cco-helpdesk" prefix, so it must be hidden explicitly in
// the exam anti-cheat path — otherwise the bubble stays clickable during exams.
const BUBBLE_ID = "cco-ai-help-bubble";

// Stable id so client-side navigation never injects the loader twice.
const SCRIPT_ID = "cco-helpdesk-loader";

// Route prefix where the widget must NOT appear (active exam — anti-cheat).
const IN_EXAM_PREFIX = "/exam/take/";

// Selectors the external loader is known to mount its UI under. The loader is
// served from HELPDESK_ORIGIN and we don't control its internals, so we hide
// defensively: the script tag itself, any iframe pointed at the help-desk
// origin, and any container the loader marks with a cco-helpdesk hook.
function findWidgetElements(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const els = new Set<HTMLElement>();

  const script = document.getElementById(SCRIPT_ID);
  if (script) els.add(script);

  const bubble = document.getElementById(BUBBLE_ID);
  if (bubble) els.add(bubble);

  document
    .querySelectorAll<HTMLIFrameElement>("iframe")
    .forEach((frame) => {
      if (frame.src && frame.src.startsWith(HELPDESK_ORIGIN)) els.add(frame);
    });

  document
    .querySelectorAll<HTMLElement>(
      '[id^="cco-helpdesk"], [class*="cco-helpdesk"], [data-cco-helpdesk]',
    )
    .forEach((el) => els.add(el));

  return [...els];
}

// Show/hide every element the loader created. Hiding (rather than removing)
// preserves the chat session so leaving the exam restores the conversation.
function setWidgetHidden(hidden: boolean) {
  for (const el of findWidgetElements()) {
    if (hidden) {
      el.style.setProperty("display", "none", "important");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.style.removeProperty("display");
      el.removeAttribute("aria-hidden");
    }
  }
}

type HelpDeskWidgetProps = {
  /** Signed-in contact display name, or null when logged out / anonymous. */
  name?: string | null;
  /** Signed-in contact email, or null when logged out / anonymous. */
  email?: string | null;
};

export function HelpDeskWidget({ name = null, email = null }: HelpDeskWidgetProps) {
  const pathname = usePathname();
  const inExam = pathname?.startsWith(IN_EXAM_PREFIX) ?? false;

  // The contentWindow of the trusted help-desk iframe, captured when the loader
  // mounts it. Identity replies go ONLY to this window — origin-matching alone
  // would also satisfy any other frame/popup served from the help-desk origin
  // (e.g. one a malicious page opened via window.open), so we additionally pin
  // the exact window we trust.
  const trustedWindowRef = useRef<Window | null>(null);

  // Inject the loader script once, then actively show/hide the widget based on
  // whether an exam is in progress. Idempotent across client navigations.
  useEffect(() => {
    if (inExam) {
      // Soft-nav INTO an exam from a page where the widget already mounted:
      // tear the widget out of view rather than leaving it usable. (Hard
      // reload directly onto the exam route never injects in the first place.)
      setWidgetHidden(true);
      return;
    }

    // Leaving the exam (or first non-exam mount): make sure any previously
    // hidden widget is visible again.
    setWidgetHidden(false);

    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = LOADER_URL;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-channel", PORTAL_HELPDESK_CHANNEL);
    document.head.appendChild(script);

    // Capture the help-desk iframe's window once the loader mounts it, so the
    // identity handshake can pin replies to exactly that frame. The loader is
    // async, so observe the DOM until the iframe appears.
    const captureTrustedWindow = () => {
      const frame = [...document.querySelectorAll<HTMLIFrameElement>("iframe")].find(
        (f) => f.src && f.src.startsWith(HELPDESK_ORIGIN),
      );
      if (frame?.contentWindow) {
        trustedWindowRef.current = frame.contentWindow;
        return true;
      }
      return false;
    };

    if (!captureTrustedWindow()) {
      const observer = new MutationObserver(() => {
        if (captureTrustedWindow()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    // Intentionally not removed on unmount: re-injecting on every nav would
    // tear down and rebuild the chat session. In-exam it is hidden above.
  }, [inExam]);

  // Same-origin identity / context handshake.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // SECURITY: only ever talk to the help-desk iframe origin. Never '*'.
      if (event.origin !== IFRAME_ORIGIN) return;
      if (!event.source) return;

      // SECURITY: pin to the exact iframe window the loader mounted. Origin
      // alone would also admit any other frame/popup on the help-desk origin
      // (e.g. window.open('https://cco-helpdesk.vercel.app')). If we have
      // captured the trusted window, require an exact match.
      if (trustedWindowRef.current && event.source !== trustedWindowRef.current) {
        return;
      }

      const data = event.data as { type?: string } | null;
      if (!data || typeof data.type !== "string") return;

      // While an exam is active, refuse to hand identity/context to the
      // widget — belt-and-suspenders against a side-channel during exams.
      if (inExam) return;

      const post = (payload: Record<string, unknown>) => {
        (event.source as WindowProxy).postMessage(payload, IFRAME_ORIGIN);
      };

      if (data.type === "cco-request-identity") {
        post({
          type: "cco-identity",
          channel: PORTAL_HELPDESK_CHANNEL,
          name: name ?? "",
          email: email ?? "",
        });
      } else if (data.type === "cco-request-context") {
        post({
          type: "cco-page-context",
          channel: PORTAL_HELPDESK_CHANNEL,
          name: name ?? "",
          email: email ?? "",
          path: pathname ?? "",
          url: typeof window !== "undefined" ? window.location.href : "",
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [name, email, pathname, inExam]);

  return null;
}
