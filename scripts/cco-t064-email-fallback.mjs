// CCO-T064 Part B — email-fallback resolve rate (READ-ONLY). No writes.
// Waits out Podio's hourly rate limit, then resolves each no-cmid sub's customer email
// against Contacts (14660191) email field 112436968. Reports 0/1/>1 match buckets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTACTS_APP = 14660191, EMAIL_FIELD = 112436968;
const INITIAL_WAIT_S = Number(process.argv[2] || 1800); // default 30 min cooldown
const THROTTLE = 1500;

function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let token=null;
async function podioToken(){if(token)return token;const res=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!res.ok)throw new Error("auth "+res.status);token=(await res.json()).access_token;return token;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function podio(p,opts={}){for(let attempt=0;;attempt++){const t=await podioToken();const res=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(res.status===420){if(attempt<8){const ra=Number(res.headers.get("Retry-After")||"90");console.log("  420; waiting "+ra+"s");await sleep((ra+2)*1000);continue;}throw new Error("RATE_LIMIT");}if(!res.ok)throw new Error(p+" "+res.status+": "+(await res.text()).slice(0,100));return res.json();}}

async function main(){
  loadEnv();
  const subs=JSON.parse(fs.readFileSync(path.join(__dirname,"_subs_acc.json"),"utf8"));
  const noCmid=subs.filter(s=>!s.cmid);
  const emailMap=new Map(); for(const s of noCmid){const e=(s.email||"").toLowerCase().trim();if(e&&!emailMap.has(e))emailMap.set(e,s);}
  console.log(`Part B: ${emailMap.size} unique no-cmid emails. Cooldown ${INITIAL_WAIT_S}s then go.`);
  await sleep(INITIAL_WAIT_S*1000);
  console.log("cooldown done, resolving...");

  const B={zero:0,one:0,many:0,err:0,details:[]}; let k=0;
  for(const [email,s] of emailMap){
    k++; await sleep(THROTTLE);
    try{
      const r=await podio(`/item/app/${CONTACTS_APP}/filter/`,{method:"POST",body:JSON.stringify({filters:{[EMAIL_FIELD]:email},limit:5})});
      const n=r.items.length;
      if(n===0){B.zero++;B.details.push({email,pw:s.pw,n:0});}
      else if(n===1){B.one++;}
      else {B.many++;B.details.push({email,pw:s.pw,n});}
    }catch(e){B.err++;B.details.push({email,pw:s.pw,err:e.message});}
    if(k%10===0)console.log(`  ...B ${k}/${emailMap.size}`);
  }
  fs.writeFileSync(path.join(__dirname,"_audit_partB.json"),JSON.stringify(B,null,2));
  const tested=B.zero+B.one+B.many+B.err;
  console.log("\n=== PART B: email fallback resolve (no-cmid subs) ===");
  console.log(`emails tested: ${tested}/${emailMap.size}`);
  console.log(`  EXACTLY ONE Contact (clean resolve): ${B.one} (${(100*B.one/tested).toFixed(0)}%)`);
  console.log(`  ZERO Contacts (HARD GAP — teardown can't find them): ${B.zero}`);
  console.log(`  MULTIPLE Contacts (ambiguous — needs disambig): ${B.many}`);
  console.log(`  errors: ${B.err}`);
  console.log("zero/multiple/err detail:"); B.details.forEach(d=>console.log("  ",JSON.stringify(d)));
  console.log("\nwritten to scripts/_audit_partB.json");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
