#!/usr/bin/env node
/**
 * Exploration v2: discover the test-results app, then fetch the example
 * items (by app_item_id, since those are the IDs in the Podio URLs the
 * user shared).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const PODIO = "https://api.podio.com";
const OUT_DIR = path.join(process.cwd(), "scripts", "podio-explore-output");
mkdirSync(OUT_DIR, { recursive: true });

const { PODIO_CLIENT_ID, PODIO_CLIENT_SECRET, PODIO_REFRESH_TOKEN } = process.env;

if (!PODIO_CLIENT_ID || !PODIO_CLIENT_SECRET || !PODIO_REFRESH_TOKEN) {
  console.error("Missing PODIO_* env vars");
  process.exit(1);
}

async function getToken() {
  const r = await fetch(`${PODIO}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: PODIO_REFRESH_TOKEN,
      client_id: PODIO_CLIENT_ID,
      client_secret: PODIO_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error(`auth failed ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

const token = await getToken();
async function api(p, opts = {}) {
  const r = await fetch(`${PODIO}${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) return { __error: true, status: r.status, body: await r.text(), path: p };
  return r.json();
}
function dump(name, data) {
  const file = path.join(OUT_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  -> ${name}.json`);
}

// 1. Orgs/spaces (find course-management & hub)
console.log("Listing orgs ...");
const orgs = await api("/org/");
dump("10-orgs", orgs);

// We know the workspace slug from the URL: ccous (org). Let's enumerate spaces.
const ccoOrg = Array.isArray(orgs) ? orgs.find(o => o.url_label === "ccous") : null;
if (ccoOrg) {
  console.log(`Found ccous org: id=${ccoOrg.org_id}`);
  dump("11-org-ccous-spaces", ccoOrg.spaces || []);
  const courseMgmt = (ccoOrg.spaces || []).find(s => /course/i.test(s.name) || s.url_label === "course-management");
  const hub = (ccoOrg.spaces || []).find(s => /hub/i.test(s.name) || s.url_label === "hub");
  console.log(`  course-management space: ${courseMgmt?.space_id} (${courseMgmt?.name})`);
  console.log(`  hub space:               ${hub?.space_id} (${hub?.name})`);

  if (courseMgmt) {
    const apps = await api(`/app/space/${courseMgmt.space_id}/`);
    dump("12-course-mgmt-apps", apps);
    const testResultsApp = Array.isArray(apps)
      ? apps.find(a => /test.result/i.test(a.config?.name || a.url_label || ""))
      : null;
    if (testResultsApp) {
      const trAppId = testResultsApp.app_id;
      console.log(`  test-results app: ${testResultsApp.config?.name} (app_id=${trAppId})`);

      const trAppFull = await api(`/app/${trAppId}`);
      dump("13-test-results-app-full", trAppFull);

      // Fetch the example item by app_item_id
      const trItem = await api(`/app/${trAppId}/item/126523`);
      dump("14-test-result-item-126523", trItem);

      // 10 most recent results to see range of data
      const trRecent = await api(`/item/app/${trAppId}/filter/`, {
        method: "POST",
        body: JSON.stringify({ limit: 10, sort_by: "created_on", sort_desc: true }),
      });
      dump("15-test-results-recent-10", trRecent);
      if (trRecent.total != null) console.log(`  total test-results items: ${trRecent.total}`);
    } else {
      console.log("  ! test-results app not found by name match in course-management");
    }
  }

  if (hub) {
    const apps = await api(`/app/space/${hub.space_id}/`);
    dump("16-hub-apps", apps);
    const contactsApp = Array.isArray(apps)
      ? apps.find(a => /contact/i.test(a.config?.name || a.url_label || ""))
      : null;
    if (contactsApp) {
      const cAppId = contactsApp.app_id;
      console.log(`  contacts app: ${contactsApp.config?.name} (app_id=${cAppId})`);
      const cAppFull = await api(`/app/${cAppId}`);
      dump("17-contacts-app-full", cAppFull);

      const cItem = await api(`/app/${cAppId}/item/96011`);
      dump("18-contacts-item-96011", cItem);
    }
  }
}

// 2. Platform Profiles app (current auth) for comparison
const ppApp = await api("/app/30640719");
dump("19-platform-profiles-app", ppApp);

console.log("\nDone.");
