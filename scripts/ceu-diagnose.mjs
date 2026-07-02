import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const TESTS=16243239, F_NAME=125981694, F_STATUS=125981847, F_TYPE=137578152;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p){const t=await token();const r=await fetch("https://api.podio.com"+p,{headers:{Authorization:"Bearer "+t}});if(!r.ok)throw new Error(p+" "+r.status);return r.json();}
function fv(item,fid){const f=(item.fields||[]).find(x=>x.field_id===fid||x.external_id===String(fid));return f?f.values:null;}
function cat(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value?.text??"?"):"(unset)";}
function txt(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value??""):"";}
async function main(){
  loadEnv();
  const nums=[1116,1097,1736,1735];
  for(const n of nums){
    await new Promise(r=>setTimeout(r,400));
    try{
      const it=await podio(`/app/${TESTS}/item/${n}`);
      console.log(`\n#${n}  item_id=${it.item_id}  "${txt(it,F_NAME)}"`);
      console.log(`   ready-for-portal : ${cat(it,"ready-for-portal")}`);
      console.log(`   Test Status      : ${cat(it,F_STATUS)}`);
      console.log(`   Type             : ${cat(it,F_TYPE)}`);
      console.log(`   access-tier      : ${cat(it,"access-tier")}`);
      console.log(`   tracker-type     : ${cat(it,"progress-tracker-type-2")}`);
      // dump ready-for-portal field options once (to get the "Yes" option id for any fix)
      if(n===nums[0]){const f=(it.fields||[]).find(x=>x.external_id==="ready-for-portal");if(f){console.log(`   [ready-for-portal field_id=${f.field_id} options=`,JSON.stringify((f.config?.settings?.options||[]).map(o=>({id:o.id,text:o.text}))),"]");}}
    }catch(e){console.log(`\n#${n}  -> NOT FOUND in Tests app (${e.message})`);}
  }
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
