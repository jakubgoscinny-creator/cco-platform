import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const RESETS=30739071, CONTACTS=14660191, EMAIL=112436968;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});return r;}
function pdate(d){return d.toISOString().replace("T"," ").replace(/\.\d+Z$/,"");}
async function main(){
  loadEnv();
  // (a) the FIX: createItem with a NON-empty RESET_URL (the deployed placeholder) -> expect 200
  const fields={277002644:[{value:"deploy-verify@cco.us",type:"other"}],277002646:"https://portal.cco.us/forgot-password",277002647:{start:pdate(new Date(Date.now()+1800000))},277002648:1};
  const cr=await podio(`/item/app/${RESETS}/`,{method:"POST",body:JSON.stringify({fields})});
  console.log("(a) createItem with placeholder RESET_URL -> "+cr.status+(cr.ok?"  ✅ FIX WORKS (no more 400)":"  ❌ "+(await cr.text()).slice(0,150)));
  // (b) case-sensitivity proof: UPPERCASE filter should find Amanda; lowercase should not
  for(const e of ["AMANDAS.OLSEN1@GMAIL.COM","amandas.olsen1@gmail.com"]){
    await new Promise(r=>setTimeout(r,400));
    const r=await podio(`/item/app/${CONTACTS}/filter/`,{method:"POST",body:JSON.stringify({filters:{[EMAIL]:[e]},limit:3})});
    const j=await r.json();
    console.log(`(b) filter "${e}" -> ${j.items?.length??"?"} match(es)`+((j.items&&j.items[0])?` (item ${j.items[0].item_id})`:""));
  }
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
