#!/usr/bin/env node
// CCO-T034 diagnostic (read-only): inspect a Test Results item to confirm
// Mary's ACTION chain processed a portal-created row.
//   Run: node --env-file=.env --env-file=.env.local scripts/inspect-podio-item.mjs <itemId>
const PODIO_API = "https://api.podio.com";

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
  if (!res.ok) throw new Error(`auth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

const id = Number(process.argv[2]);
const token = await getAccessToken();
const res = await fetch(`${PODIO_API}/item/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const item = await res.json();

const field = (fid) => item.fields?.find((f) => f.field_id === fid);
const show = (label, fid) => {
  const f = field(fid);
  if (!f) return console.log(`${label}: (empty)`);
  const v = f.values?.[0]?.value;
  if (v && typeof v === "object")
    console.log(`${label}: ${v.title ?? v.text ?? JSON.stringify(v)}`);
  else console.log(`${label}: ${JSON.stringify(f.values)}`);
};

console.log("Title:", item.title);
console.log("---");
show("Contact (125914549)", 125914549);
show("Exam Lookup (142217973)", 142217973);
show("Progress Tracker Type (128205567)", 128205567);
show("Test Source (146183536)", 146183536);
show("ACTION 1 Contact (149821869)", 149821869);
show("ACTION 2 Test&PT (133039300)", 133039300);
show("ACTION 3 Commentary (171918764)", 171918764);
show("ACTION 4 Chapter (184537890)", 184537890);
console.log("--- Comments (chain activity) ---");
for (const c of item.comments ?? []) {
  console.log("  •", (c.value ?? "").replace(/\s+/g, " ").slice(0, 180));
}
