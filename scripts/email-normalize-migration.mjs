// CCO email-case normalization migration. Lowercases plain-email Contact values
// so the case-sensitive Podio lookup always matches. Resumable + checkpointed.
//   DRY-RUN (default): node email-normalize-migration.mjs [maxPages]
//   EXECUTE:           node email-normalize-migration.mjs --execute [maxPages]
// Skips non-plain-email values (e.g. "Name <addr>" integration contacts).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const CONTACTS=14660191, EMAIL=112436968, PAGE=100, THROTTLE=350;
const EXECUTE=process.argv.includes("--execute");
const MAXPAGES=Number(process.argv.find(a=>/^\d+$/.test(a))||9999);
const CKPT=path.join(__dirname,"_email-migration-progress.json");
const PLAIN=/^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/;
function loadEnv(){const p=path.join(__dirname,"..",".env.local");for(const l of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(!m)continue;let v=m[2].trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(!(m[1] in process.env))process.env[m[1]]=v;}}
let tok=null; async function token(){if(tok)return tok;const r=await fetch("https://api.podio.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:process.env.PODIO_REFRESH_TOKEN,client_id:process.env.PODIO_CLIENT_ID,client_secret:process.env.PODIO_CLIENT_SECRET})});if(!r.ok)throw new Error("auth "+r.status);tok=(await r.json()).access_token;return tok;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function podio(p,opts={}){for(let a=0;;a++){const t=await token();const r=await fetch("https://api.podio.com"+p,{...opts,headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",...(opts.headers||{})}});if(r.status===420){if(a<6){await sleep(62000);continue;}throw new Error("RATE_LIMIT");}if(!r.ok)throw new Error(p+" "+r.status);return r.json();}}
async function main(){
  loadEnv();
  let st={offset:0,scanned:0,fixable:0,fixed:0,skippedJunk:0,examples:[]};
  if(process.argv.includes("--resume")&&fs.existsSync(CKPT))st=JSON.parse(fs.readFileSync(CKPT,"utf8"));
  console.log(`MODE: ${EXECUTE?"EXECUTE (writing)":"DRY-RUN (no writes)"} | start offset ${st.offset} | max ${MAXPAGES} pages`);
  for(let pg=0; pg<MAXPAGES; pg++){
    await sleep(THROTTLE);
    let page; try{page=await podio(`/item/app/${CONTACTS}/filter/`,{method:"POST",body:JSON.stringify({limit:PAGE,offset:st.offset})});}catch(e){console.log("stopped: "+e.message+" (resume with --resume)");break;}
    if(pg===0&&st.offset===0)console.log("total contacts:",page.total);
    if(!page.items.length)break;
    for(const it of page.items){
      st.scanned++;
      const f=(it.fields||[]).find(x=>x.field_id===EMAIL); if(!f)continue;
      let needs=false; const nv=f.values.map(v=>{const s=String(v.value); if(PLAIN.test(s)&&s!==s.toLowerCase()){needs=true; return {type:v.type,value:s.toLowerCase()};} return {type:v.type,value:s};});
      const hasJunkUpper=f.values.some(v=>{const s=String(v.value);return s!==s.toLowerCase()&&!PLAIN.test(s);});
      if(hasJunkUpper&&!needs)st.skippedJunk++;
      if(needs){st.fixable++; if(st.examples.length<10)st.examples.push(f.values.find(v=>PLAIN.test(String(v.value))&&String(v.value)!==String(v.value).toLowerCase())?.value);
        if(EXECUTE){await sleep(THROTTLE); try{await podio(`/item/${it.item_id}`,{method:"PUT",body:JSON.stringify({fields:{[EMAIL]:nv}})}); st.fixed++;}catch(e){console.log("  write fail item "+it.item_id+": "+e.message);}}}
    }
    st.offset+=PAGE;
    fs.writeFileSync(CKPT,JSON.stringify(st));
    if(pg%10===9)console.log(`  ...scanned ${st.scanned}, fixable ${st.fixable}, fixed ${st.fixed}`);
  }
  console.log(`\nscanned ${st.scanned} | FIXABLE plain-email (non-lowercase) ${st.fixable} | ${EXECUTE?"FIXED "+st.fixed:"(dry-run, nothing written)"} | junk Name<addr> skipped ${st.skippedJunk}`);
  console.log("examples of fixable student emails:", JSON.stringify(st.examples.filter(Boolean)));
  console.log("checkpoint:",CKPT);
}
main().catch(e=>{console.error("ERR:",e.message);process.exit(1);});
