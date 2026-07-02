// CCO-T064 Part B (corrected) — email-fallback resolve over the 32 "neither" subs.
// Uses the proven auth.ts method: email-type field filters on a STRING ARRAY and is
// CASE-SENSITIVE (CCO-T028) -> try as-typed then lowercase. READ-ONLY.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTACTS_APP = 14660191, EMAIL_FIELD = 112436968;
const INITIAL_WAIT_S = Number(process.env.WAIT || 900), THROTTLE = 1500;

function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let token=null;
async function podioToken(){if(token)return token;const res=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!res.ok)throw new Error("auth "+res.status);token=(await res.json()).access_token;return token;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function podio(p,opts={}){for(let a=0;;a++){const t=await podioToken();const res=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(res.status===420){if(a<8){const ra=Number(res.headers.get("Retry-After")||"90");console.log("  420; waiting "+ra+"s");await sleep((ra+2)*1000);continue;}throw new Error("RATE_LIMIT");}if(!res.ok)throw new Error(res.status+": "+(await res.text()).slice(0,120));return res.json();}}

async function countByEmail(email){
  const variants=[email.trim()]; const lo=email.trim().toLowerCase(); if(lo!==email.trim())variants.push(lo);
  let best=0;
  for(const v of variants){const r=await podio(`/item/app/${CONTACTS_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[EMAIL_FIELD]:[v]},limit:5})}); best=Math.max(best,r.items.length); if(best>0)break;}
  return best;
}

async function main(){
  loadEnv();
  const files=process.argv.slice(2);
  let subs=[]; for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));subs=subs.concat(j.data);}
  const seen=new Set(); subs=subs.filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true;});
  const neither=[]; const em=new Set();
  for(const s of subs){const cs=s.metadata?.community_member_id||"";const cust=(s.customer&&typeof s.customer==="object")?s.customer:{};const cc=cust.metadata?.community_member_id||"";const email=cust.email||"";if(!cs&&!cc&&email){const k=email.toLowerCase();if(!em.has(k)){em.add(k);neither.push({email,pw:s.metadata?.paywall_id||"",desc:s.description||""});}}}
  console.log(`"neither" (no id on sub or customer) unique emails: ${neither.length}`);
  console.log(`cooldown ${INITIAL_WAIT_S}s ...`); await sleep(INITIAL_WAIT_S*1000); console.log("go.");
  const B={one:0,zero:0,many:0,err:0,details:[]}; let k=0;
  for(const r of neither){ k++; await sleep(THROTTLE);
    try{ const n=await countByEmail(r.email);
      if(n===1)B.one++; else if(n===0){B.zero++;B.details.push({...r,n:0});} else {B.many++;B.details.push({...r,n});}
    }catch(e){B.err++;B.details.push({...r,err:e.message});}
    if(k%8===0)console.log(`  ...${k}/${neither.length}`);
  }
  fs.writeFileSync(path.join(__dirname,"_audit_partB2.json"),JSON.stringify(B,null,2));
  const tested=B.one+B.zero+B.many+B.err;
  console.log(`\n=== PART B (corrected): email fallback over ${tested} truly-no-id subs ===`);
  console.log(`  resolve to EXACTLY ONE Contact (clean): ${B.one}`);
  console.log(`  ZERO (HARD GAP - no join path at all): ${B.zero}`);
  console.log(`  MULTIPLE (ambiguous): ${B.many}`);
  console.log(`  errors: ${B.err}`);
  console.log("non-clean detail:"); B.details.forEach(d=>console.log("  ",JSON.stringify(d)));
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
