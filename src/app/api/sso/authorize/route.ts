/**
 * GET /api/sso/authorize
 *
 * OAuth 2.0 authorization endpoint. Circle (cco.academy) sends users
 * here to obtain an authorization code.
 *
 * Query params (standard OAuth):
 *   - client_id       must match SSO_CLIENT_ID
 *   - redirect_uri    must resolve to an origin in ALLOWED_REDIRECT_ORIGINS
 *   - state           opaque, passed back unchanged
 *   - response_type   must be "code"
 *   - scope           (ignored — we always return email + name)
 *
 * Behavior:
 *   - No cco_session cookie → 302 to /sign-in?return_to=<this URL>. After
 *     login, the user lands back here with a session and the dance
 *     completes without them re-entering any Circle state.
 *   - Valid cco_session → mark contact as circle_member, issue a signed
 *     60s code JWT, and 302 to redirect_uri?code=...&state=...
 */

import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  issueAuthorizationCode,
  markAsCircleMember,
  parseAllowedRedirectUri,
  validateClientId,
} from "@/lib/sso";

export const runtime = "nodejs";

function badRequest(msg: string): Response {
  return new Response(msg, { status: 400 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") ?? "";
  const responseType = params.get("response_type");

  // --- Validate the OAuth request -----------------------------------------
  if (!clientId || !validateClientId(clientId)) {
    return badRequest("invalid client_id");
  }
  if (responseType !== "code") {
    return badRequest("response_type must be 'code'");
  }
  if (!redirectUri) {
    return badRequest("missing redirect_uri");
  }
  const parsedRedirect = parseAllowedRedirectUri(redirectUri);
  if (!parsedRedirect) {
    return badRequest("redirect_uri origin not allowed");
  }

  // --- Authenticate the user ----------------------------------------------
  const session = await getSession();
  if (!session) {
    // Not logged in. Send them through the normal portal login, asking
    // the login action to return here when done. `return_to` is a
    // relative path so loginAction's allowlist (must start with /) passes.
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    const signInUrl = new URL("/sign-in", request.nextUrl);
    signInUrl.searchParams.set("return_to", returnTo);
    return new Response(null, {
      status: 302,
      headers: { Location: signInUrl.toString() },
    });
  }

  // Resolve the contact's email (needed in the code payload + later in
  // /userinfo). We re-read from the mirror instead of trusting the
  // cookie, so a stale cookie can't smuggle a stale email.
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, session.contactId),
  });
  if (!contact) {
    // Session cookie references a contact that no longer exists in the
    // mirror — treat as unauthenticated rather than leak an error.
    return badRequest("session references unknown contact");
  }

  // Reaching this endpoint via a Circle-issued redirect is itself
  // evidence the user is on cco.academy → mark them as a Circle member.
  // Idempotent; cheap.
  await markAsCircleMember(contact.podioItemId);

  // Issue the authorization code and send the browser back to Circle.
  const code = issueAuthorizationCode(contact.email, contact.podioItemId);
  const back = new URL(parsedRedirect.toString());
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: back.toString() },
  });
}
