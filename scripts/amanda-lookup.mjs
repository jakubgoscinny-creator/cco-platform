import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const CONTACTS=14660191, EMAIL=112436968, DUP=125701761;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function filt(email){const t=await token();const r=await fetch(`https://api.podio.com/item/app/${CONTACTS}/filter/`,{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({filters:{[EMAIL]:[email]},limit:25})});if(!r.ok)return {err:r.status+": "+(await r.text()).slice(0,120)};return r.json();}
function fv(it,fid){const f=(it.fields||[]).find(x=>x.field_id===fid);return f?f.values:null;}
function dupText(it){const v=fv(it,DUP);return v&&v[0]?(v[0].value?.text??"?"):"(unset)";}
function emailVals(it){const v=fv(it,EMAIL);return v?v.map(x=>x.value).join(","):"";}
async function main(){
  loadEnv();
  for(const e of ["amandas.olsen1@gmail.com","Amandas.Olsen1@gmail.com"]){
    await new Promise(r=>setTimeout(r,400));
    const res=await filt(e);
    if(res.err){console.log(`\nfilter "${e}" -> ERR ${res.err}`);continue;}
    console.log(`\nfilter "${e}" -> ${res.items.length} match(es)`);
    res.items.forEach(it=>console.log(`   item ${it.item_id} | "${(fv(it,112436965)?.[0]?.value)||""}" | emails=[${emailVals(it)}] | DuplicateStatus=${dupText(it)}`));
  }
  console.log("\n(IF branch needs an ACTIVE/unflagged match; SUSPECTED/CONFIRMED DUPLICATE => disqualified => else branch => empty RESET_URL => 400)");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
