/**
 * POST /api/sso/token
 *
 * Server-to-server call from Circle. Exchanges an authorization code
 * (issued by /authorize) for an access token.
 *
 * Body may be application/x-www-form-urlencoded or application/json with:
 *   - grant_type    ("authorization_code")
 *   - code          (the signed code JWT we issued)
 *   - client_id     (must match SSO_CLIENT_ID)
 *   - client_secret (must match SSO_CLIENT_SECRET)
 *
 * Returns: { access_token, token_type: "Bearer", expires_in }
 */

import type { NextRequest } from "next/server";
import {
  issueAccessToken,
  SSO_ACCESS_TOKEN_TTL_SECONDS,
  validateClientCredentials,
  verifyAuthorizationCode,
} from "@/lib/sso";

export const runtime = "nodejs";

interface TokenRequestBody {
  grant_type?: string;
  code?: string;
  client_id?: string;
  client_secret?: string;
}

function oauthError(error: string, description?: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function parseBody(request: NextRequest): Promise<TokenRequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as TokenRequestBody;
    } catch {
      return {};
    }
  }
  // Default: form-encoded (standard for OAuth token endpoint)
  const form = await request.formData();
  return {
    grant_type: form.get("grant_type")?.toString(),
    code: form.get("code")?.toString(),
    client_id: form.get("client_id")?.toString(),
    client_secret: form.get("client_secret")?.toString(),
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await parseBody(request);

  // Also accept client credentials via HTTP Basic per the OAuth 2.0 spec
  const basicAuth = request.headers.get("authorization");
  let clientId = body.client_id;
  let clientSecret = body.client_secret;
  if (basicAuth?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(basicAuth.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx !== -1) {
        clientId = clientId ?? decoded.slice(0, idx);
        clientSecret = clientSecret ?? decoded.slice(idx + 1);
      }
    } catch {
      return oauthError("invalid_client", "malformed Basic auth", 401);
    }
  }

  if (body.grant_type !== "authorization_code") {
    return oauthError("unsupported_grant_type");
  }
  if (!body.code) {
    return oauthError("invalid_request", "missing code");
  }
  if (!clientId || !clientSecret || !validateClientCredentials(clientId, clientSecret)) {
    return oauthError("invalid_client", undefined, 401);
  }

  let codePayload;
  try {
    codePayload = verifyAuthorizationCode(body.code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid code";
    return oauthError("invalid_grant", msg);
  }

  const accessToken = issueAccessToken(codePayload.contactId, codePayload.email);

  return Response.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: SSO_ACCESS_TOKEN_TTL_SECONDS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
