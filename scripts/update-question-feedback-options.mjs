#!/usr/bin/env node
// CCO-T068 follow-up: re-tone the Issue Type category on the CCO Question Feedback
// app (30767002) to the welcoming vocabulary (positive-first). The app has no
// items yet, so relabel/add is safe. Keeps existing option ids (1-5) stable;
// adds 2 new ones (Love this question / Suggestion or idea). Re-reads + prints
// the id map to paste into QUESTION_FEEDBACK_OPTIONS.ISSUE_TYPE.
//   Run: node --env-file=.env.local scripts/update-question-feedback-options.mjs
const API = "https://api.podio.com";
const APP = 30767002;
const ISSUE_FIELD = 277340079;

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
  return (await res.json()).access_token;
}

const t = await token();
const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };

const options = [
  { text: "Love this question", status: "active" }, // new
  { text: "Suggestion or idea", status: "active" }, // new
  { id: 1, text: "Answer key looks off", status: "active" },
  { id: 3, text: "Wording could be clearer", status: "active" },
  { id: 2, text: "Typo or formatting", status: "active" },
  { id: 4, text: "Might be outdated", status: "active" },
  { id: 5, text: "Something else", status: "active" },
];

const res = await fetch(`${API}/app/${APP}/field/${ISSUE_FIELD}`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({
    label: "Issue Type",
    settings: { options },
  }),
});
if (!res.ok) {
  console.error(`field update failed ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log("Issue Type options updated.");

// re-read
const app = await (await fetch(`${API}/app/${APP}`, { headers: auth })).json();
const field = (app.fields ?? []).find((f) => f.field_id === ISSUE_FIELD);
console.log("\nLive options (text -> id):");
const byText = {};
for (const o of field?.config?.settings?.options ?? []) {
  if (o.status !== "active") continue;
  byText[o.text] = o.id;
  console.log(`  ${String(o.id).padStart(2)}  "${o.text}"`);
}
const map = {
  praise: byText["Love this question"],
  suggestion: byText["Suggestion or idea"],
  answer_key: byText["Answer key looks off"],
  unclear: byText["Wording could be clearer"],
  typo: byText["Typo or formatting"],
  outdated: byText["Might be outdated"],
  other: byText["Something else"],
};
console.log("\nQUESTION_FEEDBACK_OPTIONS.ISSUE_TYPE =", JSON.stringify(map));
