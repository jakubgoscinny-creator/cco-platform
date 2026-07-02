import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
loadEnv();
const t=await token();
const r=await fetch("https://api.podio.com/app/16243239",{headers:{Authorization:"Bearer "+t}});
const app=await r.json();
for(const f of app.fields||[]){
  if(["ready-for-portal","access-tier"].includes(f.external_id) || f.field_id===125981847){
    const opts=(f.config?.settings?.options||[]).map(o=>({id:o.id,text:o.text,status:o.status}));
    console.log(`field ${f.field_id} ext="${f.external_id}" label="${f.config?.label}" type=${f.type}`);
    console.log("  options:",JSON.stringify(opts));
  }
}
