#!/usr/bin/env node
/**
 * CCO-T063 — register native Podio webhooks for the portal receiver.
 *
 * Creates one hook per (app × event) pointing at the deployed receiver:
 *   <WEBHOOK_BASE_URL>/api/webhooks/podio/<PODIO_WEBHOOK_SECRET>/<app>
 * The secret AND the app live in the PATH (not the query string) because Podio
 * does NOT forward the query string on its callbacks (verified live 2026-06-25 —
 * query-based `?key=` verify pings 401'd), and its hook POST sends no custom
 * headers. The `<app>` path segment tells the receiver which mirror to update
 * (Podio does not put app_id in the body).
 *
 * IMPORTANT — deploy first. Creating a hook makes Podio immediately POST a
 * `hook.verify` to the URL; the DEPLOYED receiver echoes the code back and the
 * hook flips to active. So the route must already be live in prod WITH
 * PODIO_WEBHOOK_SECRET set before you run `register`.
 *
 * Usage (from cco-platform/):
 *   node --env-file=.env --env-file=.env.local scripts/register-podio-hooks.mjs list
 *   node --env-file=.env --env-file=.env.local scripts/register-podio-hooks.mjs register
 *   node --env-file=.env --env-file=.env.local scripts/register-podio-hooks.mjs verify
 *   node --env-file=.env --env-file=.env.local scripts/register-podio-hooks.mjs delete-all
 *
 * Env required: PODIO_REFRESH_TOKEN, PODIO_CLIENT_ID, PODIO_CLIENT_SECRET,
 * PODIO_WEBHOOK_SECRET, and WEBHOOK_BASE_URL (defaults to https://portal.cco.us).
 */
const PODIO_API = "https://api.podio.com";
const BASE_URL = (process.env.WEBHOOK_BASE_URL ?? "https://portal.cco.us").replace(/\/$/, "");
const SECRET = process.env.PODIO_WEBHOOK_SECRET;

// Scope order (CCO-T063): Tests + Domains first. Add pt/contacts here later.
// NOTE: these literals MIRROR the canonical sources and must be kept in sync when
// scope expands — app IDs live in PODIO_APPS (src/lib/podio.ts) and the handled
// event types live in handlePodioEvent's switch (src/lib/podio-webhook.ts).
const APPS = [
  { name: "tests", appId: 16243239 },
  { name: "domains", appId: 16336321 },
];
const EVENTS = ["item.create", "item.update", "item.delete"];

// Hook URLs carry the shared secret as a PATH segment. NEVER print them raw —
// redact the secret so it can't leak into terminal scrollback / CI logs.
function redactUrl(url) {
  // /api/webhooks/podio/<secret>/<app> → /api/webhooks/podio/***/<app>
  return String(url).replace(
    /(\/api\/webhooks\/podio\/)[^/?#]+/i,
    "$1***"
  );
}

// Secret + app live in the PATH (Podio drops the query string on callbacks).
// base64url secrets contain no characters that need URL-encoding.
function hookUrl(appName) {
  return `${BASE_URL}/api/webhooks/podio/${SECRET}/${appName}`;
}

// Compare ignoring the secret segment so a rotated key doesn't create duplicates.
function sameTarget(existingUrl, appName) {
  try {
    const a = new URL(existingUrl);
    const base = new URL(BASE_URL);
    return (
      a.origin === base.origin &&
      a.pathname.startsWith("/api/webhooks/podio/") &&
      a.pathname.endsWith(`/${appName}`)
    );
  } catch {
    return false;
  }
}

async function getAccessToken() {
  const res = await fetch(`${PODIO_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Podio auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${PODIO_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const getHooks = (token, appId) => api(token, "GET", `/hook/app/${appId}/`);
const createHook = (token, appId, url, type) =>
  api(token, "POST", `/hook/app/${appId}/`, { url, type });
const deleteHook = (token, hookId) => api(token, "DELETE", `/hook/${hookId}`);
const requestVerify = (token, hookId) =>
  api(token, "POST", `/hook/${hookId}/verify/request`);

async function listAll(token) {
  for (const app of APPS) {
    const hooks = await getHooks(token, app.appId);
    console.log(`\n${app.name} (app ${app.appId}) — ${hooks.length} hook(s):`);
    for (const hk of hooks) {
      console.log(`  • #${hk.hook_id} ${hk.type.padEnd(12)} ${hk.status.padEnd(8)} ${redactUrl(hk.url)}`);
    }
  }
}

async function register(token) {
  for (const app of APPS) {
    const existing = await getHooks(token, app.appId);
    for (const type of EVENTS) {
      const dup = existing.find((hk) => hk.type === type && sameTarget(hk.url, app.name));
      if (dup) {
        console.log(`= ${app.name}/${type}: exists #${dup.hook_id} (${dup.status}) — skip`);
        continue;
      }
      const created = await createHook(token, app.appId, hookUrl(app.name), type);
      console.log(
        `+ ${app.name}/${type}: created #${created.hook_id} — Podio is verifying against the live receiver…`
      );
    }
  }
  console.log("\nRun `list` to confirm each hook flipped to status=active.");
}

async function verifyInactive(token) {
  for (const app of APPS) {
    const hooks = await getHooks(token, app.appId);
    for (const hk of hooks) {
      if (hk.status === "active") continue;
      await requestVerify(token, hk.hook_id);
      console.log(`↻ re-requested verify for #${hk.hook_id} (${app.name}/${hk.type})`);
    }
  }
  console.log("\nRun `list` again to confirm. (Receiver must be deployed with the matching secret.)");
}

async function deleteAll(token) {
  for (const app of APPS) {
    const hooks = await getHooks(token, app.appId);
    for (const hk of hooks) {
      if (!sameTarget(hk.url, app.name)) {
        console.log(`· #${hk.hook_id} (${redactUrl(hk.url)}) is not a portal hook — leaving it`);
        continue;
      }
      await deleteHook(token, hk.hook_id);
      console.log(`- deleted #${hk.hook_id} (${app.name}/${hk.type})`);
    }
  }
}

const mode = process.argv[2] ?? "list";

if (mode !== "list" && !SECRET) {
  console.error("PODIO_WEBHOOK_SECRET is required for register/verify/delete-all.");
  process.exit(1);
}

const token = await getAccessToken();
if (mode === "list") await listAll(token);
else if (mode === "register") await register(token);
else if (mode === "verify") await verifyInactive(token);
else if (mode === "delete-all") await deleteAll(token);
else {
  console.error(`Unknown mode "${mode}". Use: list | register | verify | delete-all`);
  process.exit(1);
}
