/**
 * Shared outbound links so independent surfaces can't drift.
 *
 * ACADEMY_URL is Circle's SSO-initiate endpoint (NOT the bare homepage).
 * Anywhere it's used the visitor already holds a live portal session, so
 * hitting `/oauth2/initiate` kicks off the OAuth dance against the portal
 * IdP (`/api/sso/authorize`), which sees the session and signs the user
 * straight into Circle — no second login. A bare `cco.academy` link instead
 * drops a session-less visitor on Circle's logged-out homepage (the bug
 * Jakub caught in a clean window 2026-05-28, CCO-T032).
 *
 * Used by the post-login chooser (`(authenticated)/page.tsx`, same tab —
 * Laureen's preference) and the TopBar Academy button (CCO-T075, new tab so
 * a mid-exam student doesn't lose their place). Keep it here so the two
 * cannot silently diverge.
 */
export const ACADEMY_URL = "https://www.cco.academy/oauth2/initiate";
