#!/usr/bin/env node
// CCO-T034 recovery: set both "View Results" calc fields to the exact target
// script (original logic + a "CCO Portal" branch). Uses MINIMAL config
// ({label, config:{settings:{script, return_type}}}) — echoing the full config
// nulled the script. Verifies after each write.
//   Run: node --env-file=.env --env-file=.env.local scripts/restore-fix-view-results.mjs
const PODIO_API = "https://api.podio.com";
const APP = 16234798;

const STAFF = `var TestSource = @[Test Source](field_146183536)
var LinkToResult = ""
var ResultID = @[result__ID](field_147831161)
var ResultLinkID = @[result__link_result_id](field_125913687)
var TestTitle = @[test__test_title](field_150751888)
var TestID = @[test__test_id](field_125913681)
var LinkID = @[link__link_id](field_125913228)
var DisplayLink = true

if((TestSource == "ProProfs") && (ResultID == null)){
  DisplayLink = false
}


if(TestSource == "Classmarker"){
  LinkToResult = "https://www.classmarker.com/a/results/tests/test/nrgusers/results/?test_id="+TestID+"&nrg_id="+LinkID+"&score_id="+ResultLinkID+"&return=search"
}

if(TestSource == "ProProfs"){
  LinkToResult = "https://www.proprofs.com/quiz-school/scorereport/?sid="+ResultID+"&title="+TestTitle
}
if(TestSource == "Xenforo"){
  LinkToResult = "https://www.cco.community/exams/results/"+ResultID
}
if(TestSource == "CCO Portal"){
  LinkToResult = "https://cco-platform.vercel.app/exam/results/"+ResultID
}


// FINAL OUTPUT

if(DisplayLink == true){
  TestSource.link(LinkToResult)+ "    (you must be logged into "+TestSource+" to view)"
} else {
  "Not Available"
}
`;

const STUDENTS = `var TestSource = @[Test Source](field_146183536)
var LinkToResult = ""
var ResultID = @[result__ID](field_147831161)
var ResultLinkID = @[result__link_result_id](field_125913687)
var TestTitle = @[test__test_title](field_150751888)
var TestID = @[test__test_id](field_125913681)
var LinkID = @[link__link_id](field_125913228)
var FullName = @[result__first](field_125913230)+" "+@[result__last](field_125911818)

FullName = FullName.replace(/ /g, "+");

var DisplayLink = true

if((TestSource == "ProProfs") && (ResultID == null)){
  DisplayLink = false
}

if(TestSource == "Classmarker"){
  DisplayLink = false    //disabling Classmarker results for now during testing
  LinkToResult = "https://www.classmarker.com/a/results/tests/test/nrgusers/results/?test_id="+TestID+"&nrg_id="+LinkID+"&score_id="+ResultLinkID+"&return=search"
}

if(TestSource == "ProProfs"){
  LinkToResult = "https://www.proprofs.com/quiz-school/certificate/pdf.php?sid="+ResultID+"&title="+TestTitle+"&id="+ResultID+"&qid="+TestID+"&uname="+FullName+"&saveAs=PDFCertificate"
}
if(TestSource == "Xenforo"){
  LinkToResult = "https://www.cco.community/exams/results/"+ResultID
}
if(TestSource == "CCO Portal"){
  LinkToResult = "https://cco-platform.vercel.app/exam/results/"+ResultID
}

// FINAL OUTPUT

if(DisplayLink == true){
  TestSource.link(LinkToResult)+" THIS LINK IS IN ALPHA TESTING as at June 26 2017"
} else {
  "Not Available"
}
`;

const TARGETS = [
  { fid: 125937527, label: "View Results | CCO Staff", script: STAFF },
  { fid: 150750509, label: "View Results | Students", script: STUDENTS },
];

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

const token = await getToken();

for (const { fid, label, script } of TARGETS) {
  const put = await fetch(`${PODIO_API}/app/${APP}/field/${fid}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // Correct shape per podio-build-kit repair_fields.py apply_calcs: label +
    // settings at the TOP LEVEL (NOT nested under config — that nulls the script).
    body: JSON.stringify({
      label,
      required: false,
      settings: { script, return_type: "text" },
    }),
  });
  if (!put.ok) {
    console.error(`field ${fid}: PUT failed ${put.status} ${await put.text()}`);
    continue;
  }
  // Verify
  const res = await fetch(`${PODIO_API}/app/${APP}/field/${fid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const f = await res.json();
  const s = f.config?.settings?.script;
  console.log(
    `field ${fid} (${label}): script length=${s ? s.length : "NULL"}, has Xenforo=${!!s && s.includes("Xenforo")}, has CCO Portal=${!!s && s.includes("CCO Portal")}`
  );
}
