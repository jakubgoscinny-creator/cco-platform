#!/usr/bin/env node
// CCO-T034: add a "CCO Portal" branch to the two "View Results" calc fields on
// the Test Results app so portal-sourced rows render a working link to
// /exam/results/{result__ID}. Idempotent (skips if already patched), aborts if
// the anchor isn't found, and verifies after writing.
//   Run: node --env-file=.env --env-file=.env.local scripts/patch-view-results-calc.mjs
const PODIO_API = "https://api.podio.com";
const APP = 16234798;
const FIELDS = [125937527, 150750509]; // View Results | CCO Staff, | Students

const XENFORO_BLOCK = `if(TestSource == "Xenforo"){
  LinkToResult = "https://www.cco.community/exams/results/"+ResultID
}`;
const CCO_BLOCK = `
if(TestSource == "CCO Portal"){
  LinkToResult = "https://cco-platform.vercel.app/exam/results/"+ResultID
}`;

async function getToken() {
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

async function getField(token, fid) {
  const res = await fetch(`${PODIO_API}/app/${APP}/field/${fid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET field ${fid}: ${res.status} ${await res.text()}`);
  return res.json();
}

const token = await getToken();

for (const fid of FIELDS) {
  const f = await getField(token, fid);
  const script = f.config.settings.script;

  if (script.includes('TestSource == "CCO Portal"')) {
    console.log(`field ${fid} (${f.label}): already patched — skip`);
    continue;
  }
  if (!script.includes(XENFORO_BLOCK)) {
    console.error(`field ${fid} (${f.label}): Xenforo anchor not found — ABORTING (needs manual review)`);
    continue;
  }

  const newScript = script.replace(XENFORO_BLOCK, XENFORO_BLOCK + CCO_BLOCK);
  const newConfig = {
    ...f.config,
    settings: { ...f.config.settings, script: newScript },
  };

  const put = await fetch(`${PODIO_API}/app/${APP}/field/${fid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ label: f.config.label ?? f.label, config: newConfig }),
  });
  if (!put.ok) {
    console.error(`field ${fid}: PUT failed ${put.status} ${await put.text()}`);
    continue;
  }

  const after = await getField(token, fid);
  const ok = after.config.settings.script.includes('TestSource == "CCO Portal"');
  console.log(`field ${fid} (${f.label}): patched = ${ok}`);
}
