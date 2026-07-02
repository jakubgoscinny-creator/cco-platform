import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const TESTS=16243239, F_NAME=125981694, F_STATUS=125981847, F_TYPE=137578152;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(p+" "+r.status);return r.json();}
function fv(item,fid){const f=(item.fields||[]).find(x=>x.field_id===fid||x.external_id===String(fid));return f?f.values:null;}
function cat(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value?.text??"?"):"(unset)";}
function txt(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value??""):"";}
function dump(it){
  console.log(`\nitem ${it.app_item_id} (id ${it.item_id})  "${txt(it,F_NAME)}"`);
  console.log(`   ready-for-portal : ${cat(it,"ready-for-portal")}`);
  console.log(`   Test Status      : ${cat(it,F_STATUS)}`);
  console.log(`   Type             : ${cat(it,F_TYPE)}`);
  console.log(`   access-tier      : ${cat(it,"access-tier")}`);
  console.log(`   tracker-type     : ${cat(it,"progress-tracker-type-2")}`);
}
async function main(){
  loadEnv();
  // known three
  for(const aid of [2933,3020,3019]){ await new Promise(r=>setTimeout(r,400)); try{dump(await podio(`/app/${TESTS}/item/${aid}`));}catch(e){console.log("  "+aid+" err "+e.message);} }
  // find #1116
  await new Promise(r=>setTimeout(r,500));
  const r=await podio(`/search/app/${TESTS}/`,{method:"POST",body:JSON.stringify({query:"Community Q&A #1116",limit:8})});
  const arr=Array.isArray(r)?r:(r.results||[]);
  console.log("\nsearch #1116 hits:"); arr.forEach(x=>console.log("   "+(x.title||"?")+"  ["+(x.link||"")+"]"));
  // try to fetch the best match (title contains 1116)
  const hit=arr.find(x=>(x.title||"").includes("1116"));
  if(hit){const m=(hit.link||"").match(/items\/(\d+)/); if(m){await new Promise(r=>setTimeout(r,400)); dump(await podio(`/app/${TESTS}/item/${m[1]}`));}}
  else console.log("  (no #1116 title match — may not exist as a Test)");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
