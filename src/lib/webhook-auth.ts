/**
 * CCO-T063: shared-secret auth primitives for inbound webhooks.
 *
 * This is the SHARED-SECRET model used by the Podio→portal webhook
 * (POST /api/webhooks/podio/[secret]/[app]). The route reads the secret from the
 * URL PATH for native Podio hooks (Podio sends no headers AND drops the query
 * string on its callbacks — verified live 2026-06-25). These helpers cover the
 * FALLBACK channels a GlobiFlow "send to webhook" push can use instead:
 *   - `Authorization: Bearer <secret>` header, or
 *   - `?key=<secret>` query param.
 *
 * NOTE — this is deliberately NOT how the Stripe webhook authenticates. Per the
 * CCO-T064 design, `POST /api/stripe/webhook` verifies an HMAC signature via
 * `stripe.webhooks.constructEvent(rawBody, sig, whsec)`, a different (stronger,
 * Stripe-native) model. Do not route Stripe through these helpers. The "shared
 * discipline" across /api/webhooks is conceptual (fail-closed, timing-safe,
 * idempotent), not shared code.
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret comparison. Returns false on length mismatch (a string's
 * length is not itself secret, and timingSafeEqual throws on unequal lengths).
 * Callers MUST fail closed (treat a missing configured secret as "no match").
 */
export function secretEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extract the presented secret from a request, supporting both delivery shapes:
 * `Authorization: Bearer <secret>` (header) takes precedence over `?key=<secret>`
 * (query). Returns "" when neither is present — never throws. Structurally typed
 * so it accepts a NextRequest as well as a test double.
 */
export function extractRequestSecret(req: {
  headers: Pick<Headers, "get">;
  nextUrl: { searchParams: Pick<URLSearchParams, "get"> };
}): string {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const key = req.nextUrl.searchParams.get("key");
  return bearer ?? key ?? "";
}
