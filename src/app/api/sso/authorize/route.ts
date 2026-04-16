/**
 * GET /api/sso/authorize
 *
 * Entry point for Circle SSO. Circle's browser redirect lands here with:
 *   - client_id      (must match SSO_CLIENT_ID)
 *   - redirect_uri   (must be on cco.academy)
 *   - state          (opaque, passed through)
 *   - response_type  (must be "code")
 *   - jwt            (Circle-signed HS256 JWT with the user's identity)
 *
 * On success we upsert the user, set the cco_session cookie so they land
 * on the portal authenticated, then 302 back to redirect_uri?code=...&state=...
 */

import type { NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import {
  circleJwtImpliesMembership,
  extractName,
  issueAuthorizationCode,
  upsertCircleUser,
  validateClientId,
  verifyCircleJwt,
} from "@/lib/sso";

export const runtime = "nodejs";

const ALLOWED_REDIRECT_ORIGIN = "https://cco.academy";

function badRequest(msg: string): Response {
  return new Response(msg, { status: 400 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? "";
  const responseType = params.get("response_type");
  const circleToken = params.get("jwt");

  if (!clientId || !validateClientId(clientId)) {
    return badRequest("invalid client_id");
  }
  if (responseType !== "code") {
    return badRequest("response_type must be 'code'");
  }
  if (!redirectUri) {
    return badRequest("missing redirect_uri");
  }
  // Strict allowlist: scheme + host, not just startsWith on the full string,
  // to block tricks like https://cco.academy.evil.com/ or path-prefix smuggles.
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return badRequest("invalid redirect_uri");
  }
  if (parsedRedirect.origin !== ALLOWED_REDIRECT_ORIGIN) {
    return badRequest("redirect_uri must be on cco.academy");
  }
  if (!circleToken) {
    return badRequest("missing jwt");
  }

  // Verify the Circle-signed JWT
  let payload;
  try {
    payload = verifyCircleJwt(circleToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "jwt verification failed";
    return new Response(`invalid jwt: ${msg}`, { status: 401 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) {
    return badRequest("jwt missing email");
  }

  const fullName = extractName(payload);
  const circleMember = circleJwtImpliesMembership(payload);

  // Upsert in Podio Platform Profiles + Neon contacts mirror
  const user = await upsertCircleUser({ email, fullName, circleMember });

  // Create a cco_session row + set the cookie so when the user eventually
  // lands on /catalog (after Circle's callback forwards them), the
  // existing getSession() in auth.ts authenticates them without a re-login.
  await createSession(user.contactId);

  // Issue the short-lived authorization code (60s TTL)
  const code = issueAuthorizationCode(user.email, user.contactId);

  // Redirect back to Circle's callback
  const back = new URL(parsedRedirect.toString());
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);

  // Plain 302 + Location — Next.js attaches the Set-Cookie headers from
  // cookies().set(...) inside createSession() to whatever response we return.
  // (Response.redirect() returns a locked response we can't augment.)
  return new Response(null, {
    status: 302,
    headers: { Location: back.toString() },
  });
}
