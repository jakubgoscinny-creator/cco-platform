import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const APP=30739071;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status+": "+(await r.text()).slice(0,100));tok=(await r.json()).access_token;return tok;}
function podioDate(d){return d.toISOString().replace("T"," ").replace(/\.\d+Z$/,"");}
async function main(){
  loadEnv();
  const t=await token();
  // 1) app schema check
  const ar=await fetch(`https://api.podio.com/app/${APP}`,{headers:{Authorization:"Bearer "+t}});
  console.log("GET /app/"+APP+" -> "+ar.status);
  if(ar.ok){const app=await ar.json();console.log("  app:",app.config?.name,"status:",app.status);console.log("  fields:",(app.fields||[]).map(f=>f.field_id+":"+(f.config?.label||f.external_id)).join(", "));}
  else {console.log("  body:",(await ar.text()).slice(0,200)); if(ar.status===420){console.log("\n>> Podio is RATE-LIMITED right now (420).");} return;}
  // 2) reproduce the exact createItem (enumeration-safe: no recipient contact => workflow marks Skipped, no email)
  const fields={
    277002644:[{value:"portal-diagnostic-test@cco.us",type:"other"}],
    277002646:"",
    277002647:{start:podioDate(new Date(Date.now()+30*60*1000))},
    277002648:1
  };
  const cr=await fetch(`https://api.podio.com/item/app/${APP}/`,{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({fields})});
  console.log("\nPOST createItem -> "+cr.status);
  const body=await cr.text();
  if(cr.ok){const j=JSON.parse(body);console.log("  ✅ created item_id="+j.item_id+" (Skipped, no email). The portal's Podio write WORKS right now.");}
  else {console.log("  ❌ ERROR body:",body.slice(0,400));}
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
