/**
 * GET /api/cron/sync   (CCO-T045 — reliable Podio→Neon resync)
 *
 * Forces a full Podio → Neon resync of Tests + Domains so the portal reflects
 * current Podio state (catalog, access_tier, student tracker type, Ready-for-
 * Portal flag). This replaces relying on the fire-and-forget background refresh
 * in `getTests()`, which Vercel suspends the moment a page response returns —
 * so Mary's Podio edits often never propagated. Manual/interim trigger until
 * the event-driven Podio→portal webhook lands (next-session work).
 *
 * Guarded by CRON_SECRET (server-only env). Accepts the secret as either:
 *   Authorization: Bearer <CRON_SECRET>   (Vercel Cron sends this shape)
 *   ?key=<CRON_SECRET>                     (convenient for a manual curl)
 * Fails CLOSED if CRON_SECRET is unset (so the route is inert until the secret
 * is provisioned in the deployment env). Idempotent (upsert).
 */
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  syncTestsFromPodio,
  syncDomainsFromPodio,
  getActiveTests,
} from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unprovisioned
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const key = request.nextUrl.searchParams.get("key");
  const provided = bearer ?? key ?? "";
  return safeEqual(provided, secret);
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    await syncTestsFromPodio();
    await syncDomainsFromPodio();
    const active = await getActiveTests();
    return Response.json({
      ok: true,
      readyForPortalTests: active.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("CCO-T045 /api/cron/sync failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
