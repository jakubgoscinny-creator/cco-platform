import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const CONTACTS=14660191, EMAIL=112436968, CIRCLE=272609487, DUP=125701761, PWM=199172888;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
async function podio(p,opts={}){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(!r.ok)throw new Error(p+" "+r.status+": "+(await r.text()).slice(0,120));return r.json();}
function f(it,fid){const x=(it.fields||[]).find(y=>y.field_id===fid);return x?x.values:null;}
function txt(it,fid){const v=f(it,fid);return v&&v[0]?(v[0].value?.text??v[0].value??""):"";}
function emails(it){return (it.fields||[]).filter(x=>x.type==="email").map(x=>x.config?.label+"=["+x.values.map(v=>v.value).join(",")+"]").join("  ");}
function phones(it){return (it.fields||[]).filter(x=>x.type==="phone").map(x=>x.values.map(v=>v.value).join(",")).join(" ");}
async function main(){
  loadEnv();
  const seen=new Set(); const hits=[];
  for(const q of ["amandas.olsen1@gmail.com","Amanda Olsen","3254510386"]){
    await new Promise(r=>setTimeout(r,400));
    try{const r=await podio(`/search/app/${CONTACTS}/`,{method:"POST",body:JSON.stringify({query:q,limit:8})});
      const arr=Array.isArray(r)?r:(r.results||[]);
      console.log(`\nsearch "${q}" -> ${arr.length}`);
      for(const x of arr){const m=(x.link||"").match(/items\/(\d+)/);const aid=m?m[1]:null;console.log("   "+(x.title||"?")+"  ["+(x.link||"")+"]"); if(aid&&!seen.has(aid)){seen.add(aid);hits.push(aid);}}
    }catch(e){console.log(`search "${q}" err: ${e.message}`);}
  }
  console.log("\n=== CONTACT DETAILS ===");
  for(const aid of hits.slice(0,6)){
    await new Promise(r=>setTimeout(r,400));
    try{const it=await podio(`/app/${CONTACTS}/item/${aid}`);
      console.log(`\nContact item ${it.item_id} (app#${it.app_item_id}) "${it.title}"`);
      console.log("   emails: "+(emails(it)||"(none)"));
      console.log("   primary EMAIL(112436968): ["+(f(it,EMAIL)||[]).map(v=>v.value).join(",")+"]");
      console.log("   phone: "+(phones(it)||"(none)"));
      console.log("   Circle Member ID(272609487): "+(txt(it,CIRCLE)||"(unset)"));
      console.log("   Duplicate Status: "+(txt(it,DUP)||"(unset)"));
      console.log("   Has PASSWORD_MASTER? "+((f(it,PWM)&&f(it,PWM)[0]&&f(it,PWM)[0].value)?"YES":"no"));
    }catch(e){console.log("  item "+aid+" err "+e.message);}
  }
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
