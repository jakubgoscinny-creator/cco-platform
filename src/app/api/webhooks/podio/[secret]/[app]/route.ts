/**
 * POST /api/webhooks/podio/[secret]/[app]   (CCO-T063 — event-driven Podio → portal sync)
 *
 * Receiver for native Podio webhooks. The shared secret AND the target app are
 * carried in the URL PATH, not the query string: **Podio does NOT forward the
 * query string on its callbacks** (verified live 2026-06-25 — query-based
 * `?key=` verify pings returned 401 while the same key in a manual request
 * passed). So the hook is registered as:
 *   <base>/api/webhooks/podio/<PODIO_WEBHOOK_SECRET>/<tests|domains>
 *
 * Auth fails closed (inert until PODIO_WEBHOOK_SECRET is set) + timing-safe. A
 * GlobiFlow push (which CAN set headers/query) may instead present the secret as
 * `Authorization: Bearer` or `?key=` — still accepted as a fallback. The target
 * app comes from the path (Podio omits app_id from the body) — required for
 * item.delete, where the item is already gone.
 *
 * Always returns 2xx once authorized — even on an internal error — so Podio does
 * not retry-then-DISABLE the hook. A dropped event (any type) self-heals on the
 * next /api/cron/sync run: upserts re-converge changed rows and the reconcile-
 * prune reconciles deletes (see sync.ts pruneMissing).
 *
 * NOTE — the Stripe webhook is a SEPARATE surface (`/api/stripe/webhook`, HMAC
 * `constructEvent` per CCO-T064), not this shared-secret route.
 */
import type { NextRequest } from "next/server";
import { secretEquals, extractRequestSecret } from "@/lib/webhook-auth";
import {
  parseWebhookBody,
  normalizePodioEvent,
  resolveWebhookApp,
  handlePodioEvent,
} from "@/lib/podio-webhook";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(pathSecret: string, request: NextRequest): boolean {
  const secret = process.env.PODIO_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed when unprovisioned
  // Primary: secret in the path (the only channel Podio preserves on callbacks).
  if (pathSecret && secretEquals(pathSecret, secret)) return true;
  // Fallback: Authorization: Bearer / ?key= (GlobiFlow push or manual testing).
  return secretEquals(extractRequestSecret(request), secret);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string; app: string }> }
): Promise<Response> {
  const { secret: pathSecret, app: pathApp } = await params;

  if (!authorized(pathSecret, request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const text = await request.text().catch(() => "");
    const raw = parseWebhookBody(text, request.headers.get("content-type") ?? "");
    const event = normalizePodioEvent(raw);
    const appParam = pathApp ?? request.nextUrl.searchParams.get("app");
    const app = resolveWebhookApp(appParam, event.appId);

    const result = await handlePodioEvent(event, app);
    if (!result.ok) {
      console.warn("CCO-T063 podio webhook no-op:", {
        type: event.type,
        app: appParam,
        result,
      });
    }
    // `received` always true once authorized (the route handled it); `ok`/
    // `action` describe what the event actually did.
    return Response.json({ received: true, ...result });
  } catch (err) {
    // Swallow to 200: a non-2xx makes Podio retry then disable the hook. The
    // cron safety-net reconciles whatever this dropped. Logged for visibility.
    console.error(
      "CCO-T063 podio webhook error (returning 200 to keep hook enabled):",
      err
    );
    return Response.json({ received: true, ok: false, action: "error", error: "internal" });
  }
}
