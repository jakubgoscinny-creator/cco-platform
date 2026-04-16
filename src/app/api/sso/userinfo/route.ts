/**
 * GET /api/sso/userinfo
 *
 * Server-to-server call from Circle. Validates the Bearer access token
 * and returns the user's profile in OpenID-Connect userinfo shape.
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/schema";
import { verifyAccessToken } from "@/lib/sso";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return new Response("missing bearer token", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="cco-portal"' },
    });
  }

  const token = auth.slice(7).trim();
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid token";
    return new Response(msg, {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer error="invalid_token", error_description="${msg}"`,
      },
    });
  }

  const contactId = Number(payload.sub);
  if (!Number.isFinite(contactId)) {
    return new Response("invalid subject", { status: 400 });
  }

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, contactId),
  });
  if (!contact) {
    return new Response("user not found", { status: 404 });
  }

  return Response.json(
    {
      sub: String(contact.podioItemId),
      email: contact.email,
      name: contact.fullName ?? "",
      // circle_member is an extension claim — useful for future gating
      circle_member: contact.circleMember,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
