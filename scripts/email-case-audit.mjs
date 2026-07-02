import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const CONTACTS=14660191, EMAIL=112436968;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(r.status===420)throw new Error("RATE_LIMIT");if(!r.ok)throw new Error(p+" "+r.status);return r.json();}
function email(it){const f=(it.fields||[]).find(x=>x.field_id===EMAIL);return f&&f.values&&f.values[0]?(f.values[0].value||""):"";}
async function main(){
  loadEnv();
  let total=0, withEmail=0, nonLower=0; const examples=[];
  for(const off of [0,100,200,300,400]){
    await new Promise(r=>setTimeout(r,500));
    let page; try{page=await podio(`/item/app/${CONTACTS}/filter/`,{method:"POST",body:JSON.stringify({limit:100,offset:off})});}catch(e){console.log("stopped at offset "+off+": "+e.message);break;}
    if(off===0)console.log("Contacts app total items:",page.total);
    for(const it of page.items){total++;const e=email(it);if(!e)continue;withEmail++;if(e!==e.toLowerCase()){nonLower++;if(examples.length<12)examples.push(e);}}
  }
  console.log(`\nSAMPLE: ${total} contacts scanned | ${withEmail} have an email | ${nonLower} are NON-lowercase (${withEmail?(100*nonLower/withEmail).toFixed(1):0}%)`);
  console.log("examples of non-lowercase stored emails:"); examples.forEach(e=>console.log("   "+e));
  console.log("\n(These members cannot be found by the case-sensitive email lookup -> cannot log in OR reset.)");
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
