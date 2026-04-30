#!/usr/bin/env node
/**
 * Read the JSON dumps from explore-podio and produce a concise field-list
 * summary for the Test Results and Contacts apps + the example items.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "scripts", "podio-explore-output");
const read = (n) => JSON.parse(readFileSync(path.join(DIR, n), "utf8"));

function summarizeApp(label, app) {
  if (app?.__error) return `## ${label}\nERROR: ${app.status} ${app.body}\n`;
  const name = app.config?.name || app.url_label;
  const id = app.app_id;
  const space = app.space_id;
  const fields = (app.fields || []).map((f) => {
    const t = f.type;
    const refs =
      t === "app"
        ? ` -> apps[${(f.config?.settings?.referenced_apps || [])
            .map((r) => `${r.app?.app_id}:${r.app?.config?.name || r.app?.config?.item_name || "?"}`)
            .join(", ")}]`
        : "";
    const opts =
      t === "category"
        ? ` opts=[${(f.config?.settings?.options || []).map((o) => `${o.id}:${o.text}`).join(" | ")}]`
        : "";
    return `  - [${f.field_id}] ${f.external_id} (${t}): ${f.label}${refs}${opts}`;
  });
  return `## ${label} — "${name}" (app_id=${id}, space=${space})\n${fields.join("\n")}\n`;
}

function summarizeItem(label, item) {
  if (item?.__error) return `## ${label}\nERROR: ${item.status} ${item.body}\n`;
  const lines = [`## ${label} — item_id=${item.item_id}, app_item_id=${item.app_item_id}, title="${item.title}"`];
  for (const f of item.fields || []) {
    let v = "";
    const vals = f.values || [];
    if (!vals.length) continue;
    switch (f.type) {
      case "text":
      case "number":
      case "calculation":
      case "duration":
        v = vals.map((x) => x.value).join(" | ");
        break;
      case "category":
        v = vals.map((x) => x.value?.text).join(" | ");
        break;
      case "app":
        v = vals
          .map((x) => `ref item ${x.value?.item_id} (${x.value?.app?.config?.name || "?"}: "${x.value?.title}")`)
          .join(" | ");
        break;
      case "date":
        v = vals.map((x) => `${x.start_utc || x.start || ""} -> ${x.end_utc || x.end || ""}`).join(" | ");
        break;
      case "contact":
        v = vals.map((x) => `${x.value?.name || ""} <${x.value?.mail?.[0] || ""}>`).join(" | ");
        break;
      case "email":
      case "phone":
        v = vals.map((x) => `${x.value?.type || ""}:${x.value?.value || x.value || ""}`).join(" | ");
        break;
      default:
        v = JSON.stringify(vals).slice(0, 200);
    }
    lines.push(`  [${f.field_id}] ${f.external_id} (${f.type}) "${f.label}": ${v}`);
  }
  return lines.join("\n") + "\n";
}

const out = [];
out.push("# Podio Exploration Summary");
out.push(`Generated: ${new Date().toISOString()}\n`);

out.push("\n# APP DEFINITIONS\n");
out.push(summarizeApp("Test Results app", read("13-test-results-app-full.json")));
out.push(summarizeApp("Contacts app", read("17-contacts-app-full.json")));
out.push(summarizeApp("Platform Profiles app (CURRENT auth)", read("19-platform-profiles-app.json")));

out.push("\n# EXAMPLE ITEMS\n");
out.push(summarizeItem("Test Result item 126523", read("14-test-result-item-126523.json")));
out.push(summarizeItem("Contacts item 96011", read("18-contacts-item-96011.json")));

out.push("\n# RECENT TEST-RESULT VOLUME\n");
const recent = read("15-test-results-recent-10.json");
if (recent.total != null) out.push(`Total test-result items: ${recent.total}`);
out.push("Most recent 10 (created_on desc):");
for (const it of recent.items || []) {
  const trField = (it.fields || []).find((f) => f.external_id === "test" || /test/i.test(f.label));
  const contactField = (it.fields || []).find((f) => f.type === "contact" || /student|user|contact/i.test(f.label || ""));
  out.push(`  - app_item_id=${it.app_item_id} created=${it.created_on}`);
}

const outFile = path.join(DIR, "SUMMARY.md");
writeFileSync(outFile, out.join("\n"));
console.log("Summary written to", outFile);
