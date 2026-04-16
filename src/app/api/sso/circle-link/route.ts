/**
 * GET /api/sso/circle-link
 *
 * Helper for Laureen: returns the exact portal receiver URL, the
 * expected JWT claims, and an example link shape that should be
 * embedded on cco.academy. This is an operator-facing informational
 * endpoint — NOT part of the SSO flow itself. Safe to expose
 * publicly (nothing secret here).
 *
 * Typical usage:
 *   curl https://<portal>/api/sso/circle-link
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const origin = request.nextUrl.origin;
  const receiver = `${origin}/api/sso/circle`;

  return Response.json(
    {
      description:
        "Portal receiver for Circle-issued SSO tokens. The token-signing " +
        "service on cco.academy's side (Cloudflare Worker / Vercel edge " +
        "function / etc.) generates a short-lived HS256 JWT signed with " +
        "SSO_CIRCLE_JWT_SECRET (shared secret) and 302-redirects the user " +
        "to the URL below with ?token=<jwt> appended.",

      receiver_url: receiver,

      example_url: `${receiver}?token=<HS256_JWT_SIGNED_WITH_SSO_CIRCLE_JWT_SECRET>`,

      jwt_requirements: {
        algorithm: "HS256",
        max_age_seconds: 300,
        recommended_ttl_seconds: 60,
        signing_secret_env_var: "SSO_CIRCLE_JWT_SECRET (shared with portal)",
        required_claims: {
          email: "string — the Circle member's email",
          exp: "number — unix seconds; short TTL recommended",
          iat: "number — unix seconds (jose enforces maxTokenAge from this)",
        },
        optional_claims: {
          name: "string — full name (else first_name + last_name used)",
          first_name: "string",
          last_name: "string",
          avatar_url: "string — ignored by portal for now, reserved",
          community_member_id: "number — Circle's internal ID (audit only)",
          is_member: "boolean — explicit membership flag (default true)",
        },
      },

      flow: [
        "1. Circle HTML widget renders <a href='https://<signer>/launch?...'>Take CEU Quiz</a>",
        "2. User clicks; signer identifies them (Circle cookie or merge tag)",
        "3. Signer generates HS256 JWT with claims above",
        "4. Signer 302s to " + receiver + "?token=<jwt>",
        "5. Portal verifies JWT, upserts user, sets cco_session cookie, 302 to /catalog",
      ],

      security_notes: [
        "SSO_CIRCLE_JWT_SECRET MUST remain server-side only. Never embed in HTML/JS.",
        "Portal caps JWT lifetime at 300s regardless of what exp says.",
        "If the signer issues a token with exp > 300s from now, portal rejects it.",
        "Rotate SSO_CIRCLE_JWT_SECRET by updating Vercel env + signer env atomically.",
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
