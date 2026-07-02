// CCO-T064 FULL audit (READ-ONLY). No writes.
// Part A: SIP coverage for EVERY active sub carrying community_member_id (dedup by cmid).
// Part B: email-fallback resolve rate for active subs WITHOUT community_member_id.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTACTS_APP = 14660191, CONTACT_CIRCLE_MEMBER_ID = 272609487;
const SIP_APP = 17122975, SIP_CONTACT_FIELD = 133632962, SIP_STATUS_FIELD = 199828123;
const THROTTLE = 220;

function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let token=null;
async function podioToken(){if(token)return token;const res=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!res.ok)throw new Error("auth "+res.status);token=(await res.json()).access_token;return token;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function podio(p,opts={}){for(let attempt=0;;attempt++){const t=await podioToken();const res=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(res.status===420){if(attempt<2){await sleep(62000);continue;}throw new Error("RATE_LIMIT");}if(!res.ok)throw new Error(p+" "+res.status+": "+(await res.text()).slice(0,100));return res.json();}}
function fieldVals(item,fid){const f=(item.fields||[]).find(x=>x.field_id===fid);return f?f.values:null;}

async function main(){
  loadEnv();
  const subs=JSON.parse(fs.readFileSync(path.join(__dirname,"_subs_acc.json"),"utf8"));
  const cmidMap=new Map(); for(const s of subs){if(s.cmid&&!cmidMap.has(s.cmid))cmidMap.set(s.cmid,s);}
  const noCmid=subs.filter(s=>!s.cmid);
  const emailMap=new Map(); for(const s of noCmid){const e=(s.email||"").toLowerCase().trim(); if(e&&!emailMap.has(e))emailMap.set(e,s);}
  console.log(`unique cmids: ${cmidMap.size}; unique no-cmid emails: ${emailMap.size}`);

  // discover email field id on Contacts
  let emailField=112436968;
  try{const sample=await podio(`/item/app/${CONTACTS_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[CONTACT_CIRCLE_MEMBER_ID]:String([...cmidMap.keys()][0])},limit:1})});
    if(sample.items[0]){const ef=(sample.items[0].fields||[]).find(f=>f.type==="email");if(ef)emailField=ef.field_id;console.log("Contacts email field detected:",emailField);}
  }catch(e){console.log("email-field discovery err:",e.message);}

  // ---- PART A: SIP coverage over all unique cmids ----
  const A={resolved:0,contactMissing:0,activeSip:0,noneActive:0,zeroSip:0,gaps:[]};
  const statusDist={}; let i=0;
  for(const [cmid,s] of cmidMap){
    i++; await sleep(THROTTLE);
    let c; try{c=await podio(`/item/app/${CONTACTS_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[CONTACT_CIRCLE_MEMBER_ID]:String(cmid)},limit:1})});}
    catch(e){if(e.message==="RATE_LIMIT"){console.log("rate-limited at A#"+i+"; stopping Part A");break;} A.contactMissing++; continue;}
    if(!c.items.length){A.contactMissing++;A.gaps.push({cmid,pw:s.pw,reason:"no Contact for cmid"});continue;}
    A.resolved++; const cid=c.items[0].item_id;
    await sleep(THROTTLE);
    let sip; try{sip=await podio(`/item/app/${SIP_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[SIP_CONTACT_FIELD]:[cid]},limit:100})});}
    catch(e){if(e.message==="RATE_LIMIT"){console.log("rate-limited at A#"+i+" (sip); stopping");break;} continue;}
    if(!sip.items.length){A.zeroSip++;A.gaps.push({cmid,pw:s.pw,cid,reason:"ZERO SIPs"});continue;}
    let anyActive=false;
    for(const it of sip.items){const v=fieldVals(it,SIP_STATUS_FIELD);const label=v&&v[0]?(v[0].value?.text??"?"):"(none)";statusDist[label]=(statusDist[label]||0)+1;const torn=/suspend|remove|delet|lapse|expire|cancel|inactive/i.test(label);if(!torn&&label!=="(none)")anyActive=true;}
    if(anyActive)A.activeSip++; else {A.noneActive++;A.gaps.push({cmid,pw:s.pw,cid,reason:"SIPs but none active"});}
    if(i%40===0)console.log(`  ...A ${i}/${cmidMap.size}`);
  }

  // ---- PART B: email fallback resolve over no-cmid subs ----
  const B={zero:0,one:0,many:0,err:0,details:[]}; let k=0;
  for(const [email,s] of emailMap){
    k++; await sleep(THROTTLE);
    try{const r=await podio(`/item/app/${CONTACTS_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[emailField]:email},limit:5})});
      const n=r.items.length; if(n===0){B.zero++;B.details.push({email,pw:s.pw,n:0});} else if(n===1){B.one++;} else {B.many++;B.details.push({email,pw:s.pw,n});}
    }catch(e){if(e.message==="RATE_LIMIT"){console.log("rate-limited at B#"+k+"; stopping Part B");break;} B.err++; B.details.push({email,pw:s.pw,err:e.message});}
    if(k%20===0)console.log(`  ...B ${k}/${emailMap.size}`);
  }

  const out={A:{...A,gaps:A.gaps},B,statusDist,counts:{uniqueCmid:cmidMap.size,uniqueNoCmidEmail:emailMap.size}};
  fs.writeFileSync(path.join(__dirname,"_audit_results.json"),JSON.stringify(out,null,2));

  console.log("\n=== PART A: SIP coverage (unique cmids) ===");
  console.log(`processed: resolved=${A.resolved} contactMissing=${A.contactMissing}`);
  console.log(`  >=1 ACTIVE SIP: ${A.activeSip}; SIPs none active: ${A.noneActive}; ZERO SIPs: ${A.zeroSip}`);
  console.log("SIP status dist:",JSON.stringify(statusDist));
  console.log("Part A gaps:",A.gaps.length); A.gaps.slice(0,40).forEach(g=>console.log("  ",JSON.stringify(g)));

  console.log("\n=== PART B: email fallback resolve (no-cmid subs) ===");
  console.log(`emails tested: ${B.zero+B.one+B.many+B.err}; resolve to EXACTLY ONE: ${B.one}; ZERO (gap): ${B.zero}; MULTIPLE (ambiguous): ${B.many}; errors: ${B.err}`);
  console.log("zero/multiple detail:"); B.details.forEach(d=>console.log("  ",JSON.stringify(d)));
  console.log("\nresults written to scripts/_audit_results.json");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
