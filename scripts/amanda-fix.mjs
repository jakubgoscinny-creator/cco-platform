import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ITEM=2608654539, CONTACTS=14660191, EMAIL=112436968;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(p+" "+r.status+": "+(await r.text()).slice(0,160));return r.json();}
async function main(){
  loadEnv();
  const it=await podio(`/item/${ITEM}`);
  const f=(it.fields||[]).find(x=>x.field_id===EMAIL);
  const vals=f?f.values:[];
  console.log("BEFORE:", JSON.stringify(vals.map(v=>({type:v.type,value:v.value}))));
  const newVals=vals.map(v=>({type:v.type,value:String(v.value).toLowerCase()}));
  const changed=JSON.stringify(vals.map(v=>v.value))!==JSON.stringify(newVals.map(v=>v.value));
  if(!changed){console.log("Already lowercase — nothing to do.");}
  else{
    await podio(`/item/${ITEM}`,{method:"PUT",body:JSON.stringify({fields:{[EMAIL]:newVals}})});
    const after=await podio(`/item/${ITEM}`);
    const af=(after.fields||[]).find(x=>x.field_id===EMAIL);
    console.log("AFTER :", JSON.stringify((af?af.values:[]).map(v=>({type:v.type,value:v.value}))));
  }
  // confirm the lowercase lookup now finds her
  const chk=await podio(`/item/app/${CONTACTS}/filter/`,{method:"POST",body:JSON.stringify({filters:{[EMAIL]:["amandas.olsen1@gmail.com"]},limit:2})});
  console.log(`\nlowercase lookup now -> ${chk.items.length} match(es)`+(chk.items[0]?` (item ${chk.items[0].item_id}) ✅ she can now reset + sign in`:" ❌"));
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
