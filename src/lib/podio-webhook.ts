/**
 * CCO-T063: Podio webhook event handling (the testable core of the
 * POST /api/webhooks/podio route).
 *
 * Podio posts form-encoded events with `type` + `item_id` (+ `hook_id`,
 * `item_revision_id`). Crucially the body does NOT carry the app_id, so the
 * receiver learns which app fired from the registration URL's `?app=` param
 * (e.g. `?app=tests`). That is load-bearing for `item.delete`, where the Podio
 * item is already gone and getItem can't tell us the app.
 *
 * The route stays thin (auth + read body + delegate). All routing/dispatch
 * logic lives here so it is unit-testable without a Next runtime.
 */
import { PODIO_APPS, verifyPodioHook } from "./podio";
import {
  syncOneTest,
  syncOneDomain,
  deleteTest,
  deleteDomain,
} from "./sync";

/** Podio apps this receiver mirrors. Scope order (CCO-T063): Tests + Domains
 *  first; Progress Tracker + Contacts are a documented second pass. */
export type PodioWebhookApp = "tests" | "domains";

export interface PodioWebhookEvent {
  /** e.g. "hook.verify" | "item.create" | "item.update" | "item.delete". */
  type: string;
  itemId: number | null;
  hookId: number | null;
  /** present only on the hook.verify handshake. */
  code: string | null;
  /** app_id IF a GlobiFlow push included it in the body; Podio native hooks do not. */
  appId: number | null;
}

export interface PodioEventResult {
  ok: boolean;
  action: "verified" | "synced" | "deleted" | "skipped" | "error";
  detail?: string;
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a raw webhook body (already read as text) into a flat object. Podio
 * native hooks send `application/x-www-form-urlencoded`; a GlobiFlow push may
 * send JSON. Pure + never throws. Kept here (not in the route) so it is unit-
 * testable without a Next runtime — it is the first thing every live hook hits.
 */
export function parseWebhookBody(
  text: string,
  contentType: string
): Record<string, unknown> {
  if (!text) return {};

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const json = JSON.parse(text);
      if (json && typeof json === "object") return json as Record<string, unknown>;
    } catch {
      // fall through and try urlencoded
    }
  }

  const params = new URLSearchParams(text);
  const obj: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) obj[k] = v;

  // Unlabeled JSON body? (urlencoding a JSON string yields one junk key.) Podio's
  // real form bodies always have multiple flat fields, so this can't misfire on
  // a genuine Podio event.
  if (Object.keys(obj).length <= 1 && text.trimStart().startsWith("{")) {
    try {
      const json = JSON.parse(text);
      if (json && typeof json === "object") return json as Record<string, unknown>;
    } catch {
      // keep the urlencoded result
    }
  }
  return obj;
}

/**
 * Normalize a parsed webhook body (form-encoded → strings, or JSON → mixed)
 * into a typed event. Pure; never throws.
 */
export function normalizePodioEvent(
  raw: Record<string, unknown>
): PodioWebhookEvent {
  return {
    type: typeof raw.type === "string" ? raw.type : String(raw.type ?? ""),
    itemId: toFiniteNumber(raw.item_id),
    hookId: toFiniteNumber(raw.hook_id),
    code: raw.code != null ? String(raw.code) : null,
    appId: toFiniteNumber(raw.app_id),
  };
}

const APP_BY_PARAM: Record<string, PodioWebhookApp> = {
  tests: "tests",
  domains: "domains",
};

const APP_BY_ID: Record<number, PodioWebhookApp> = {
  [PODIO_APPS.TESTS]: "tests",
  [PODIO_APPS.DOMAINS]: "domains",
};

/**
 * Decide which mirror an event targets. Prefers the explicit `?app=` registered
 * on the hook URL; falls back to a body `app_id` (GlobiFlow). Unknown → null
 * (the caller no-ops with a 200 so Podio keeps the hook enabled).
 */
export function resolveWebhookApp(
  appParam: string | null,
  appId: number | null
): PodioWebhookApp | null {
  if (appParam && APP_BY_PARAM[appParam]) return APP_BY_PARAM[appParam];
  if (appId != null && APP_BY_ID[appId]) return APP_BY_ID[appId];
  return null;
}

/**
 * Dispatch one webhook event to its side effect. May throw if a Podio/Neon call
 * fails — the route catches and still returns 200 (so a transient failure can't
 * get the hook disabled; the cron safety-net heals any dropped event).
 *
 * `app` may be null: the verify handshake is app-independent and handled first;
 * every item.* event with an unknown app is a safe no-op.
 */
export async function handlePodioEvent(
  event: PodioWebhookEvent,
  app: PodioWebhookApp | null
): Promise<PodioEventResult> {
  // Verify handshake — activate the freshly-created hook. Deliberately NOT
  // app-scoped: any hook registered on this URL (carrying the shared secret)
  // should be activated, even before its item.* handler exists. A hook for an
  // unhandled app simply no-ops ("unknown app") on later events.
  if (event.type === "hook.verify") {
    if (event.hookId == null || event.code == null) {
      return { ok: false, action: "skipped", detail: "verify missing hook_id/code" };
    }
    await verifyPodioHook(event.hookId, event.code);
    return { ok: true, action: "verified" };
  }

  if (!app) return { ok: true, action: "skipped", detail: "unknown app" };
  if (event.itemId == null) {
    return { ok: false, action: "skipped", detail: "missing item_id" };
  }

  switch (event.type) {
    case "item.create":
    case "item.update": {
      const synced =
        app === "tests"
          ? await syncOneTest(event.itemId)
          : await syncOneDomain(event.itemId);
      return synced
        ? { ok: true, action: "synced" }
        : { ok: true, action: "skipped", detail: "item did not map to a record" };
    }
    case "item.delete": {
      if (app === "tests") await deleteTest(event.itemId);
      else await deleteDomain(event.itemId);
      return { ok: true, action: "deleted" };
    }
    default:
      return { ok: true, action: "skipped", detail: `unhandled type ${event.type}` };
  }
}
