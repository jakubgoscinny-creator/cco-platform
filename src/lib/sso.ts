/**
 * Circle SSO — OAuth 2.0 where the portal is the identity provider
 * and Circle (cco.academy) is the client.
 *
 * Flow:
 *   1. User clicks "Continue with CCO Test Portal" on cco.academy.
 *   2. Circle redirects the browser to /api/sso/authorize?client_id=...
 *      &redirect_uri=https://www.cco.academy/oauth2/callback&state=...
 *      &response_type=code&scope=email+profile
 *   3. /authorize checks for a cco_session cookie:
 *        - If present → mark the contact as circle_member and issue an
 *          authorization code (signed JWT), then 302 back to redirect_uri.
 *        - If absent → 302 to /sign-in?return_to=<full authorize URL>.
 *          After login, the user lands back on /authorize with a session
 *          and the code is issued.
 *   4. Circle calls /api/sso/token server-to-server to exchange the
 *      code for an access_token.
 *   5. Circle calls /api/sso/userinfo with Authorization: Bearer <token>.
 *
 * Both `code` and `access_token` are signed HS256 JWTs. No storage table
 * needed; they verify themselves. This works on Vercel serverless
 * (no shared memory).
 */

import jwt, { type JwtPayload } from "jsonwebtoken";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { contacts } from "./schema";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const SSO_CODE_TTL_SECONDS = 60;
export const SSO_ACCESS_TOKEN_TTL_SECONDS = 3600;

// Hosts we accept as Circle's OAuth redirect_uri. Circle's current
// callback is https://www.cco.academy/oauth2/callback; we also accept
// the apex in case Circle ever drops the www. We compare on full
// URL.origin to block subdomain tricks like cco.academy.evil.com.
export const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://cco.academy",
  "https://www.cco.academy",
]);

// ---------------------------------------------------------------------------
// Authorization code (outbound from /authorize, inbound to /token)
// ---------------------------------------------------------------------------

interface AuthCodePayload extends JwtPayload {
  typ: "sso_code";
  email: string;
  contactId: number;
}

export function issueAuthorizationCode(email: string, contactId: number): string {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const payload: AuthCodePayload = { typ: "sso_code", email, contactId };
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: SSO_CODE_TTL_SECONDS,
    // Random jti so an intercepted code can't be replayed twice
    // (though the 60s TTL already keeps the window tiny)
    jwtid: randomBytes(16).toString("hex"),
  });
}

export function verifyAuthorizationCode(code: string): AuthCodePayload {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const decoded = jwt.verify(code, secret, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || decoded.typ !== "sso_code") {
    throw new Error("Invalid authorization code");
  }
  return decoded as AuthCodePayload;
}

// ---------------------------------------------------------------------------
// Access token (outbound from /token, inbound to /userinfo)
// ---------------------------------------------------------------------------

interface AccessTokenPayload extends JwtPayload {
  typ: "sso_access";
  sub: string; // contactId as string
  email: string;
}

export function issueAccessToken(contactId: number, email: string): string {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const payload: AccessTokenPayload = {
    typ: "sso_access",
    sub: String(contactId),
    email,
  };
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: SSO_ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || decoded.typ !== "sso_access") {
    throw new Error("Invalid access token");
  }
  return decoded as AccessTokenPayload;
}

// ---------------------------------------------------------------------------
// Client credential validation
// ---------------------------------------------------------------------------

export function validateClientId(clientId: string): boolean {
  return clientId === requireEnv("SSO_CLIENT_ID");
}

export function validateClientCredentials(
  clientId: string,
  clientSecret: string
): boolean {
  return (
    clientId === requireEnv("SSO_CLIENT_ID") &&
    clientSecret === requireEnv("SSO_CLIENT_SECRET")
  );
}

// ---------------------------------------------------------------------------
// Membership flag
// ---------------------------------------------------------------------------

/**
 * Mark the contact as a Circle member. Called from /authorize when a
 * Circle-driven OAuth dance starts with a valid local session — reaching
 * /authorize via a Circle redirect is itself evidence the user is on
 * cco.academy, so they're a Circle member. Idempotent.
 */
export async function markAsCircleMember(contactId: number): Promise<void> {
  await db
    .update(contacts)
    .set({ circleMember: true })
    .where(eq(contacts.podioItemId, contactId));
}

// ---------------------------------------------------------------------------
// redirect_uri validation
// ---------------------------------------------------------------------------

/**
 * Validate redirect_uri:
 *  - Must parse as a URL
 *  - Origin (scheme + host + port) must be in ALLOWED_REDIRECT_ORIGINS
 * Returns the parsed URL or null if invalid.
 */
export function parseAllowedRedirectUri(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!ALLOWED_REDIRECT_ORIGINS.has(url.origin)) return null;
  return url;
}
