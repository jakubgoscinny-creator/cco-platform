import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const TESTS=16243239, F_NAME=125981694, F_STATUS=125981847;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(p+" "+r.status+": "+(await r.text()).slice(0,120));return r.json();}
function fv(item,fid){const f=(item.fields||[]).find(x=>x.field_id===fid||x.external_id===String(fid));return f?f.values:null;}
function cat(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value?.text??"?"):"(unset)";}
function txt(item,fid){const v=fv(item,fid);return v&&v[0]?(v[0].value??""):"";}
async function main(){
  loadEnv();
  for(const q of ["Q&A","Club Q&A","Community Q&A"]){
    await new Promise(r=>setTimeout(r,500));
    try{
      const res=await podio(`/search/app/${TESTS}/v2`,{method:"POST",body:JSON.stringify({query:q,limit:15,ref_type:"item"})});
      const results=res.results||res||[];
      console.log(`\n=== search "${q}" -> ${results.length} hits ===`);
      results.forEach(r=>console.log(`   ${r.title||r.name||JSON.stringify(r).slice(0,80)}  ${r.link||""}`));
    }catch(e){console.log(`search "${q}" err: ${e.message}`);}
  }
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
