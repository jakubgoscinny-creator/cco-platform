// Publish the 2 content-ready CEU Q&A exams: ready-for-portal = Yes (option id 1, verified from app schema).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const YES=1, RFP="ready-for-portal", F_NAME=125981694;
const TARGETS=[{label:"#1097",item_id:3048659331},{label:"#1735",item_id:3292123496}];
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(p+" "+r.status+": "+(await r.text()).slice(0,160));return r.json();}
function val(it,ext){const f=(it.fields||[]).find(x=>x.external_id===ext);return f&&f.values&&f.values[0]?(f.values[0].value?.text??"?"):"(unset)";}
function txt(it,fid){const f=(it.fields||[]).find(x=>x.field_id===fid);return f&&f.values&&f.values[0]?(f.values[0].value??""):"";}
async function main(){
  loadEnv();
  for(const t of TARGETS){
    await new Promise(r=>setTimeout(r,400));
    const before=await podio(`/item/${t.item_id}`);
    console.log(`\n${t.label} "${txt(before,F_NAME)}"  before ready-for-portal=${val(before,RFP)}`);
    if(val(before,RFP)==="Yes"){console.log("   already Yes — skip");continue;}
    await new Promise(r=>setTimeout(r,400));
    await podio(`/item/${t.item_id}`,{method:"PUT",body:JSON.stringify({fields:{[RFP]:[YES]}})});
    await new Promise(r=>setTimeout(r,700));
    const after=await podio(`/item/${t.item_id}`);
    console.log(`   after  ready-for-portal=${val(after,RFP)}  ${val(after,RFP)==="Yes"?"✅ PUBLISHED":"⚠️"}`);
  }
  console.log("\nHeld (not published): #1736 (In Development), #1116 (no Test record).");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
