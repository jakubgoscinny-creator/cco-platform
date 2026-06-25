#!/usr/bin/env node
/**
 * CCO-T068: create the dedicated "CCO Question Feedback" Podio app.
 *
 * Home: space 4698044 (the content/testing space that already holds
 * QB | Multi Choice 16263017 + Tests 16243239), so Mary/Marlon triage feedback
 * next to the questions it's about. Question + Test are same-space app-refs
 * (clickable); the reporter is captured as plain Student/Contact-ID fields
 * because Contacts lives in a different space (4201014).
 *
 * Idempotent: skips creation if an app named "CCO Question Feedback" already
 * exists in the space. After create it reads the app back and prints a
 * ready-to-paste QUESTION_FEEDBACK_FIELDS constants block (real field_ids).
 *
 * Run:  node --env-file=.env.local scripts/create-question-feedback-app.mjs
 */
const API = "https://api.podio.com";
const SPACE_ID = 4698044;
const APP_NAME = "CCO Question Feedback";
const QB_APP = 16263017;
const TESTS_APP = 16243239;

async function token() {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

function cat(label, external_id, options) {
  return {
    type: "category",
    external_id,
    config: {
      label,
      settings: {
        options: options.map((text) => ({ text, status: "active" })),
        multiple: false,
        display: "inline",
      },
    },
  };
}

const FIELDS = [
  { type: "text", external_id: "feedback-comment", config: { label: "Comment", settings: { size: "large" } } },
  cat("Issue Type", "feedback-issue-type", [
    "Wrong / disputed answer key",
    "Typo or grammar",
    "Unclear or ambiguous wording",
    "Outdated guidance / code set",
    "Something else",
  ]),
  cat("Difficulty", "feedback-difficulty", ["Easy", "Medium", "Hard"]),
  cat("Status", "feedback-status", ["New", "Reviewing", "Resolved"]),
  { type: "app", external_id: "feedback-question", config: { label: "Question", settings: { referenced_apps: [{ app_id: QB_APP }] } } },
  { type: "app", external_id: "feedback-test", config: { label: "Test", settings: { referenced_apps: [{ app_id: TESTS_APP }] } } },
  { type: "number", external_id: "feedback-question-item-id", config: { label: "Question Item ID" } },
  { type: "text", external_id: "feedback-student", config: { label: "Student", settings: { size: "small" } } },
  { type: "number", external_id: "feedback-contact-id", config: { label: "Contact ID" } },
  { type: "number", external_id: "feedback-attempt-id", config: { label: "Portal Attempt ID" } },
  { type: "text", external_id: "feedback-source", config: { label: "Source", settings: { size: "small" } } },
];

const t = await token();
const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };

// `icon` is required by POST /app/. Reuse a known-valid icon from the QB app
// rather than guess an icon id (an invalid one 400s the whole create).
const qbRes = await fetch(`${API}/app/${QB_APP}`, { headers: auth });
const ICON = qbRes.ok ? (await qbRes.json()).config?.icon ?? "157.png" : "157.png";

// Idempotency guard.
const listRes = await fetch(`${API}/app/space/${SPACE_ID}/`, { headers: auth });
if (listRes.ok) {
  const existing = (await listRes.json()).find(
    (a) => a.config?.name === APP_NAME
  );
  if (existing) {
    console.log(`App "${APP_NAME}" already exists: app_id=${existing.app_id}. Skipping create.`);
    await printConstants(existing.app_id, auth);
    process.exit(0);
  }
}

const body = {
  space_id: SPACE_ID,
  config: {
    name: APP_NAME,
    item_name: "Feedback",
    description:
      "Student-reported problems with specific exam questions, captured from the CCO portal (CCO-T068). One item per report: comment + issue type + difficulty, linked to the question and test.",
    icon: ICON,
    allow_edit: true,
    allow_attachments: true,
    allow_comments: true,
  },
  fields: FIELDS,
};

const res = await fetch(`${API}/app/`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`createApp failed ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const created = await res.json();
console.log(`Created "${APP_NAME}": app_id=${created.app_id}`);
await printConstants(created.app_id, auth);

async function printConstants(appId, auth) {
  const appRes = await fetch(`${API}/app/${appId}`, { headers: auth });
  const app = await appRes.json();
  console.log("\n--- QUESTION_FEEDBACK_FIELDS (field_id by external_id) ---");
  const map = {};
  for (const f of app.fields ?? []) {
    map[f.external_id] = f.field_id;
    console.log(`  ${f.external_id.padEnd(26)} field_id=${f.field_id}  type=${f.type}`);
  }
  console.log("\nApp id:", appId, "Space:", app.space_id);
  console.log(JSON.stringify(map, null, 2));
}
