"use strict";
/* ===== Workshop Bill: core (login, bill screen, tabs, print, awaaz, offline) ===== */
const VER=7;
const SUPA="https://nkfxdznmzsrsircqutda.supabase.co";
const ANON="sb_publishable_IpyjtvFcq_gEgw4w5TBhyg_i4uOpJ6O";
const M_TR="gpt-4o-transcribe",M_CH="gpt-4o-mini";
const HINT="Motorcycle workshop in Pakistan. Words: chain kasna, brake shoe, clutch plate, spark plug, tyre, tube, engine oil, oil filter, air filter, kick, self start, carburetor, piston, cylinder, bearing, cable, mirror, indicator, battery, mazdoori, mobile oil, Lifan, Future, Honda. Bike plate like RNE 8485. Numbers are prices in rupees.";
const PARTRULES='For parts also give qty (pieces, default 1). If he says a number of pieces before or after the part name (do, teen, 2, 3, "two spark plugs"), set qty to that number. The price you return is always the total for that whole line: if he says the price is per piece (har ek, ek ka, each), multiply it by qty. Example: "do spark plug 300" means qty 2, price 300. If he names a brand or company of the part (Lifan, Future, Honda, Atlas...), put it in company, otherwise leave company empty. If a part is bought from another shop (bahar se, mohalle se, dukaan se) set outside true and shop to that shop name.';
const SYS='You help a motorcycle mechanic in Pakistan who speaks Urdu, Hindi or English mixed. Extract from the transcript: (1) the bike plate. Pakistani plates are 2 to 4 capital letters then 2 to 4 digits, for example RNE 8485, LEB 1234, ABC 123. Digits are often said in pairs, so "84 85" or "eighty four eighty five" means 8485. Join all digits and never drop any. (2) labour jobs, meaning a charge for work like chain kasna, tuning, service, or just mazdoori. If the job is only a labour or mazdoori charge, name it exactly "Labour". (3) spare parts or oil bought. Give each job and part its price in rupees (integer, 0 if not said). Never mix plate digits with prices. Write names in short English or Roman Urdu using Latin letters. '+PARTRULES+' Return JSON only: {"bike":"","work":[{"name":"","price":0}],"parts":[{"name":"","price":0,"qty":1,"company":"","outside":false,"shop":""}]}';
const WSYS='A motorcycle mechanic in Pakistan (Urdu, Hindi, English mixed) says labour jobs with prices. If a job is only a labour or mazdoori charge, name it exactly "Labour". Names in short English or Roman Urdu using Latin letters. Price in rupees, integer, 0 if not said. Return JSON only: {"work":[{"name":"","price":0}]}';
const PSYS='A motorcycle mechanic in Pakistan (Urdu, Hindi, English mixed) says spare parts or oil with prices. Names in short English or Roman Urdu using Latin letters. Price in rupees, integer, 0 if not said. '+PARTRULES+' Return JSON only: {"parts":[{"name":"","price":0,"qty":1,"company":"","outside":false,"shop":""}]}';
const BIKESYS='The text is a spoken Pakistani motorcycle number plate: 2 to 4 capital letters then 2 to 4 digits, for example RNE 8485 or LEB 1234. Digits may be said in pairs, so "84 85" means 8485. Join all digits and never drop any. Return JSON only: {"bike":"RNE8485"}';
const BIKEHINT="Pakistani motorcycle number plate, letters then digits. Examples: RNE 8485, LEB 1234, LEA 5678, ABC 1234, RIV 9021.";
const NAMESYS='The text is a person name said in Urdu, Hindi or English. Write it in Latin letters (Roman Urdu), Title Case, no titles. Return JSON only: {"name":""}';
const PHONESYS='The text is a Pakistani mobile phone number said in Urdu, Hindi or English, digits may be words or in pairs (zero teen zero zero = 0300). Return only digits, normally 11 digits starting with 03. Return JSON only: {"phone":""}';
const STSYS='A motorcycle mechanic in Pakistan says stock items he added to his shop, each with how many pieces, sometimes the brand/company, and sometimes the buying price. Names in short English or Roman Urdu using Latin letters. brand is the company name if said (Lifan, Future, Honda...), else empty. cost is the buying price of ONE piece in rupees (0 if not said; if he gives one price for all pieces together, divide by qty). Return JSON only: {"items":[{"name":"","brand":"","qty":0,"cost":0}]}';
const TTSYS='You write what a text-to-speech voice reads aloud to an unlettered Pakistani motorcycle customer to confirm his bill. Use simple spoken Urdu in Urdu script. Say the bike plate letter by letter and digits one by one. Write every number in Urdu words. Say each job and part with its price (and quantity when more than 1, and company if any), then the total to pay, and the amount still owed if any. Keep it short and clear. Return JSON only: {"say":""}';
const LOWSYS='A shopkeeper who cannot read needs to hear which items he must buy. Write one short spoken sentence in Urdu script: "یہ سامان خریدنا ہے" followed by the item names only (transliterate each name into Urdu script, include brand if given), separated by commas. Do not say any quantities or numbers. Return JSON only: {"say":""}';
const MERGE={Prefer:"resolution=merge-duplicates,return=minimal"},MIN={Prefer:"return=minimal"};

const $=id=>document.getElementById(id);
const ls={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const say=t=>{$("bar").textContent=t};
const AR="٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const fix=s=>s.replace(/[٠-٩۰-۹]/g,c=>String(AR.indexOf(c)%10));
const norm=s=>(s||"").toUpperCase().replace(/[^\p{L}\p{N}]/gu,"");
const sk=n=>String(n||"").toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g," ").replace(/\s+/g," ").trim();
const cap=s=>String(s||"").replace(/\b\w/g,c=>c.toUpperCase());
const enc=encodeURIComponent;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const p2=n=>String(n).padStart(2,"0");
const dk=d=>d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate());
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtD=d=>p2(d.getDate())+" "+MON[d.getMonth()]+" "+d.getFullYear();
const fmtT=d=>p2(d.getHours())+":"+p2(d.getMinutes());
const LIM=()=>+(ls.get("lim",5))||5;
const isNet=e=>/fetch|Internet|network|Load failed/i.test((e&&e.message)||String(e||""));
let S=ls.get("sess",null),ME=null,SHOP="",OAI="",pinHash="";
let bills=[],pays=[],stk=[],outs=[],payMap={};
let started=false,unlocked=false,datesShown=31;
const sumP=a=>a.reduce((t,x)=>t+(+x.p||0),0);

/* ---------- login / session ---------- */
async function tokenReq(body,grant){
  const r=await fetch(SUPA+"/auth/v1/token?grant_type="+grant,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error_description||j.msg||j.message||("Error "+r.status));
  S={access_token:j.access_token,refresh_token:j.refresh_token,exp:Date.now()+(j.expires_in||3600)*1000};
  ls.set("sess",S);
}
async function ensure(){
  if(!S)throw new Error("Login karein");
  if(S.exp-Date.now()<60000){
    try{await tokenReq({refresh_token:S.refresh_token},"refresh_token")}
    catch(e){if(isNet(e))throw new Error("Internet nahi hai");logout();throw new Error("Dobara login karein")}
  }
}
function logout(){S=null;ME=null;started=false;unlocked=false;bills=[];pays=[];stk=[];outs=[];ls.del("sess");ls.del("me_cache");ls.del("c_bills");ls.del("c_stk");show()}
async function db(path,opts={}){
  await ensure();
  let r;
  try{r=await fetch(SUPA+"/rest/v1/"+path,{...opts,headers:{apikey:ANON,Authorization:"Bearer "+S.access_token,"Content-Type":"application/json",...(opts.headers||{})}})}
  catch(e){throw new Error("Internet nahi hai")}
  const t=await r.text();
  if(!r.ok){let m=t;try{m=JSON.parse(t).message||t}catch(e){}throw new Error(m)}
  return t?JSON.parse(t):null;
}
const rpc=(name,body)=>db("rpc/"+name,{method:"POST",body:JSON.stringify(body||{})});
function show(){$("login").hidden=!!S;if(!S){$("app").hidden=true;$("noshop").hidden=true}else start()}
$("go").onclick=async()=>{
  $("lerr").textContent="";
  try{await tokenReq({email:$("em").value.trim(),password:$("pw").value},"password");show()}
  catch(e){$("lerr").textContent=/invalid/i.test(e.message)?"Email ya password ghalat hai":isNet(e)?"Internet nahi hai":e.message}
};
$("pw").onkeydown=e=>{if(e.key==="Enter")$("go").click()};
$("logout").onclick=logout;$("logout2").onclick=logout;
{const b=$("logoutTop");let t=0;b.onclick=()=>{if(b.dataset.s){clearTimeout(t);b.dataset.s="";b.textContent="Logout";b.style.background="#57534e";logout();return}b.dataset.s=1;b.textContent="Dobara dabayein";b.style.background="#b91c1c";t=setTimeout(()=>{b.dataset.s="";b.textContent="Logout";b.style.background="#57534e"},3000)}}

/* ---------- chal rahi bikes (tabs) ---------- */
const newJob=()=>({bike:"",work:[],parts:[],name:"",phone:"",paid:"",nextS:"",disc:"",takePrev:true,saved:false,editId:null,prevKeep:0});
let jobs=[newJob()],ji=0,cj=jobs[0];
function readFields(){cj.bike=$("bike").value;cj.name=$("cName").value;cj.phone=$("cPhone").value;cj.paid=$("paid").value;cj.nextS=$("nextS").value;cj.disc=$("disc").value;cj.takePrev=$("takePrev").checked}
function writeFields(){$("bike").value=cj.bike;$("cName").value=cj.name;$("cPhone").value=cj.phone;$("paid").value=cj.paid;$("nextS").value=cj.nextS;$("disc").value=cj.disc;$("takePrev").checked=cj.takePrev}
function saveJobs(){if(ME)ls.set("jobs_"+ME.shop_id,{list:jobs,ji})}
const keep=()=>{cj.saved=false;readFields();saveJobs()};
function switchTo(i){readFields();ji=i;cj=jobs[i];writeFields();saveJobs();render()}
const jobEmpty=j=>!j.bike&&!j.work.length&&!j.parts.length&&!j.name&&!j.phone;
function addJob(){if(jobEmpty(cj)){say("Yeh tab pehle se khali hai");return}readFields();jobs.push(newJob());switchTo(jobs.length-1)}
function closeJob(){
  jobs.splice(ji,1);if(!jobs.length)jobs.push(newJob());
  ji=Math.min(ji,jobs.length-1);cj=jobs[ji];writeFields();saveJobs();render();
}
function renderTabs(){
  const el=$("tabs");el.innerHTML="";
  jobs.forEach((j,i)=>{
    const b=document.createElement("button");b.className="tab"+(i===ji?" on":"");
    const t=document.createElement("span");t.textContent=(i===ji?cj.bike:j.bike)||"Nayi bike";b.append(t);
    b.onclick=()=>{if(i!==ji)switchTo(i)};
    if(i===ji){const c=document.createElement("span");c.className="cl";c.textContent="✕";
      c.onclick=e=>{e.stopPropagation();
        if(jobEmpty(cj)||c.dataset.s){closeJob();return}
        c.dataset.s=1;c.textContent="Pakka?";setTimeout(()=>{c.dataset.s="";c.textContent="✕"},3000)};
      b.append(c)}
    el.append(b);
  });
  const n=document.createElement("button");n.className="tab new";n.textContent="➕ Nayi bike";n.onclick=addJob;el.append(n);
}

async function start(){
  if(started)return;started=true;
  try{ME=await rpc("me");if(ME)ls.set("me_cache",ME)}
  catch(e){
    const c=ls.get("me_cache",null);
    if(c&&isNet(e)){ME=c;say("Internet nahi hai. Offline chal raha hai")}
    else{started=false;say("Dukaan ki maloomat nahi aayi: "+e.message);return}
  }
  if(!ME){$("app").hidden=true;$("noshop").hidden=false;return}
  $("noshop").hidden=true;$("app").hidden=false;
  SHOP=String(ME.name||"").toUpperCase();OAI=ME.openai_key||"";pinHash=ME.pin||"";
  $("shopName").textContent=ME.name;$("adminCard").hidden=!ME.is_admin;
  document.title=ME.name;
  const sv=ls.get("jobs_"+ME.shop_id,null);
  if(sv&&sv.list&&sv.list.length){jobs=sv.list.map(j=>({...newJob(),...j}));ji=Math.min(sv.ji||0,jobs.length-1)}
  else{const d=ls.get("draft_"+ME.shop_id,null);jobs=[{...newJob(),...(d?{bike:d.bike||"",work:d.work||[],parts:d.parts||[]}:{})}];ji=0}
  cj=jobs[ji];writeFields();
  applyFlags();
  try{await loadBills()}catch(e){say("History nahi aayi: "+e.message)}
  if(typeof adminStart==="function"&&ME.is_admin)adminStart();
}
function voiceOK(){return !!ME&&ME.voice!==false&&!!(ME.openai_key||ME.has_key)}
function applyFlags(){
  const v=voiceOK();
  document.querySelectorAll(".needvoice").forEach(e=>e.hidden=!v);
  document.querySelectorAll(".needtts").forEach(e=>{if(e.id==="speak")e.hidden=!(v&&ME&&ME.tts)});
  const t=!v?(ME&&ME.voice===false?"Awaaz is dukaan ke liye band hai":"Awaaz abhi band hai: key nahi lagi"):"Awaaz chalu ✔";
  $("voiceState").textContent=t;
  render();
}

/* ---------- bill data ---------- */
const net=b=>(b.total||0)-(b.discount||0);
function repaid(b){return payMap[b.id]||0}
function due(b){
  if(b.pending||b.moved_to)return 0;
  const n=net(b)+(b.prev_due||0),paid=b.paid==null?n:b.paid;
  return Math.max(0,n-paid-repaid(b));
}
const bikeBills=()=>{const k=norm(cj.bike);return k.length<4?[]:bills.filter(b=>!b.pending&&norm(b.bike)===k&&b.id!==cj.editId)};
const bikeDue=()=>bikeBills().reduce((t,b)=>t+due(b),0);
const total=()=>sumP(cj.work)+sumP(cj.parts);
const discV=()=>Math.max(0,Math.min(total(),+$("disc").value||0));
const prevV=()=>cj.editId?cj.prevKeep:(cj.takePrev?bikeDue():0);
const payable=()=>total()-discV()+prevV();
const paidV=()=>{const v=$("paid").value,p=payable();return v===""?p:Math.max(0,Math.min(p,+v||0))};
const strip=a=>a.map(x=>({n:x.n,p:x.p,...(x.q>1?{q:x.q}:{}),...(x.c?{c:x.c}:{}),...(x.o?{o:1,s:x.s||""}:{})}));
const addD=d=>{const x=new Date();x.setDate(x.getDate()+(+d));return dk(x)};
const qn=x=>(x.q>1?x.q+" x ":"")+x.n+(x.c?" ("+cap(x.c)+")":"");
function parseItem(t){
  const k=fix(t).trim().split(/\s+/).filter(Boolean);let p=0,q=1;
  const isQ=s=>/^(x\d+|\d+x|\d+)$/i.test(s),qv=s=>+s.replace(/x/ig,"");
  if(k.length>1&&/^\d+$/.test(k[k.length-1]))p=+k.pop();
  if(k.length>1&&isQ(k[k.length-1]))q=qv(k.pop());
  else if(k.length>1&&isQ(k[0]))q=qv(k.shift());
  return{n:k.join(" ")||"-",p,...(q>1?{q}:{})};
}
const lab=n=>/^\s*(labou?rers?|mazdoori|mazduri)\s*$/i.test(n)?"Labour":String(n||"-").replace(/\blabou?rers?\b/ig,"Labour");
const it2=i=>({n:lab(i.name),p:Math.round(+i.price)||0});
const it3=i=>({...it2(i),...(i.qty>1?{q:Math.round(i.qty)}:{}),...(i.company?{c:sk(i.company)}:{}),...(i.outside?{o:1,s:String(i.shop||"")}:{})});
const cleanBike=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

/* stock: company wali lines */
function stockRows(t){
  const k=sk(t);if(k.length<3)return[];
  const ex=stk.filter(s=>s.name===k);if(ex.length)return ex;
  return stk.filter(s=>Math.min(s.name.length,k.length)>=4&&(s.name.includes(k)||k.includes(s.name)));
}
function pickRow(x){
  const rows=stockRows(x.n);if(!rows.length)return null;
  if(x.c){const b=sk(x.c);return rows.find(r=>(r.brand||"")===b)||null}
  if(rows.length===1)return rows[0];
  return rows.find(r=>!r.brand)||null;
}
function pickBrand(name,rows){return new Promise(res=>{
  const o=document.createElement("div");o.className="sheet";
  const t=document.createElement("div");t.className="sht";t.textContent=cap(name)+": kaun si company?";o.append(t);
  rows.forEach(r=>{const b=document.createElement("button");b.className="big b";b.textContent=cap(r.brand)+" ("+r.qty+" bache)";b.onclick=()=>{o.remove();res(r.brand)};o.append(b)});
  const n=document.createElement("button");n.className="big k";n.textContent="Koi nahi / chhor dein";n.onclick=()=>{o.remove();res("")};o.append(n);
  document.body.append(o)})}
async function resolveBrand(it){
  if(it.o||it.c)return;
  const rows=stockRows(it.n),br=rows.filter(r=>r.brand);
  if(!br.length)return;
  const k=sk(it.n),hit=br.filter(r=>k.includes(r.brand));
  if(hit.length===1){it.c=hit[0].brand;const nn=sk(it.n).replace(new RegExp("\\b"+hit[0].brand.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b"),"").replace(/\s+/g," ").trim();it.n=nn||it.n;return}
  if(br.length===1&&rows.length===1){it.c=br[0].brand;return}
  const c=await pickBrand(it.n,br);if(c)it.c=c;
}
function stockLocal(items){
  for(const x of items){if(x.o)continue;const s=pickRow(x);if(s)s.qty=Math.max(0,s.qty-(x.q||1))}
}
async function logStock(logs){
  if(!logs.length)return;
  try{await db("stock_log",{method:"POST",headers:MIN,body:JSON.stringify(logs)})}catch(e){}
}
async function stockApply(items,sign,why){
  const logs=[];
  for(const x of items){
    if(x.o)continue;
    const s=pickRow(x);if(!s)continue;
    const nq=Math.max(0,s.qty+sign*(x.q||1)),real=nq-s.qty;s.qty=nq;
    await db("stock?name=eq."+enc(s.name)+"&brand=eq."+enc(s.brand||""),{method:"PATCH",headers:MIN,body:JSON.stringify({qty:s.qty})});
    if(real)logs.push({name:s.name,brand:s.brand||"",delta:real,why:why||"sale"});
  }
  await logStock(logs);
}

function buildPayMap(){payMap={};pays.forEach(p=>{payMap[p.bill_id]=(payMap[p.bill_id]||0)+p.amount})}
const pendKey=()=>"pending_"+(ME?ME.shop_id:"x");
const pendList=()=>ls.get(pendKey(),[]);
function pendBills(){
  return pendList().map((q,i)=>({...q.row,id:"p"+i,created_at:new Date(q.ts).toISOString(),pending:true}));
}
async function loadBills(){
  try{
    bills=await db("bills?select=*&order=created_at.desc&limit=3000")||[];
    try{pays=await db("payments?select=*&order=created_at.desc&limit=5000")||[]}catch(e){pays=[]}
    try{stk=await db("stock?select=*&order=name")||[]}catch(e){stk=[]}
    ls.set("c_bills",bills.slice(0,300));ls.set("c_stk",stk);
    if(pendList().length)await syncPending();
  }catch(e){
    if(isNet(e)){bills=ls.get("c_bills",[]);stk=ls.get("c_stk",[]);pays=[];say("Internet nahi hai. Purani maloomat dikh rahi hain")}
    else throw e;
  }
  bills=[...pendBills(),...bills];
  buildPayMap();
  if(unlocked)await refreshOuts();
  render();
}
let syncing=false;
async function postNew(row,outs2,moveIds,parts){
  const r=await db("bills",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)});
  const id=r&&r[0]&&r[0].id;
  if(outs2.length)await db("outside",{method:"POST",headers:MIN,body:JSON.stringify(outs2)});
  if(moveIds.length&&id)await db("bills?id=in.("+moveIds.join(",")+")",{method:"PATCH",headers:MIN,body:JSON.stringify({moved_to:id})});
  await stockApply(parts,-1,"sale");
}
async function syncPending(){
  if(syncing)return;let q=pendList();if(!q.length)return;
  syncing=true;
  try{
    try{stk=await db("stock?select=*&order=name")||stk}catch(e){}
    while(q.length){
      await postNew(q[0].row,q[0].outs,q[0].moveIds,q[0].parts);
      q=q.slice(1);ls.set(pendKey(),q);
    }
    say("Offline bills online chali gayin ✔");
    bills=await db("bills?select=*&order=created_at.desc&limit=3000")||bills;
    try{stk=await db("stock?select=*&order=name")||stk}catch(e){}
  }catch(e){}
  finally{syncing=false}
}
window.addEventListener("online",()=>{if(S&&ME&&pendList().length)loadBills().catch(()=>{})});

async function saveBill(){
  if(!cj.work.length&&!cj.parts.length){say("Pehle kaam ya parts daalein");return false}
  if(cj.saved)return true;
  readFields();
  const tt=total(),dc=discV(),pv=prevV(),pay=tt-dc+pv,paid=paidV();
  const row={bike:cj.bike.trim(),work:strip(cj.work),parts:strip(cj.parts),total:tt,discount:dc,prev_due:pv,paid,cust_name:cj.name.trim(),cust_phone:cj.phone.trim(),next_service:cj.nextS?addD(cj.nextS):null};
  if(cj.editId){
    const old=bills.find(b=>b.id===cj.editId);if(old)await stockApply(old.parts,1,"edit");
    await db("bills?id=eq."+cj.editId,{method:"PATCH",headers:MIN,body:JSON.stringify(row)});
    await stockApply(cj.parts,-1,"sale");
  }else{
    const o2=cj.parts.filter(p=>p.o).map(x=>({bike:row.bike,item:x.n,shop:x.s||"",price:x.p}));
    const moveIds=pv>0?bikeBills().filter(b=>due(b)>0).map(b=>b.id):[];
    const parts=strip(cj.parts);
    try{await postNew(row,o2,moveIds,parts)}
    catch(e){
      if(!isNet(e))throw e;
      const q=pendList();q.push({row,outs:o2,moveIds,parts,ts:Date.now()});ls.set(pendKey(),q);
      stockLocal(parts);
      say("Internet nahi hai. Bill phone mein save hui, net aate hi chali jayegi");
      finishJob();bills=[...pendBills(),...bills.filter(b=>!b.pending)];render();return true;
    }
  }
  finishJob();
  try{await loadBills()}catch(e){}
  return true;
}
function finishJob(){closeJob()}

/* ---------- screen ---------- */
function list(el,arr){
  el.innerHTML="";
  const isP=arr===cj.parts;
  arr.forEach((it,i)=>{
    const d=document.createElement("div");d.className="item";
    const n=document.createElement("div");n.className="n";n.textContent=qn(it)+(it.o?" 🌐":"");
    const p=document.createElement("input");p.type="number";p.inputMode="numeric";p.value=it.p;
    p.oninput=()=>{it.p=+p.value||0;keep();calc()};
    d.append(n,p);
    if(isP){
      const o=document.createElement("button");o.className="x";o.textContent="🌐";o.style.background=it.o?"#1d5fb4":"#a8a396";
      o.onclick=()=>{if(!it.o){it.s=prompt("Kis dukaan se liya? (khali chhod sakte hain)")||""}it.o=!it.o;keep();render()};
      d.append(o);
    }
    const x=document.createElement("button");x.className="x";x.textContent="✕";
    x.onclick=()=>{arr.splice(i,1);keep();render()};
    d.append(x);el.append(d);
  });
}
const btn=(t,f)=>{const b=document.createElement("button");b.className="big k";b.style.cssText="margin:6px 0 0;padding:10px;font-size:22px;flex:1";b.textContent=t;b.onclick=f;return b};
const row2=(txt,extra)=>{const d=document.createElement("div");d.className="item";const n=document.createElement("div");n.className="n";n.textContent=txt;d.append(n);(extra||[]).forEach(e=>d.append(e));return d};
const sm=(t,f)=>{const b=document.createElement("button");b.className="x";b.style.background="#2f7d32";b.textContent=t;b.onclick=f;return b};

function calc(){
  const tt=total(),dc=discV(),pv=prevV(),pay=tt-dc+pv;
  $("total").textContent="Total: "+pay;
  const L=[];if(dc||pv){L.push("Bill "+tt);if(dc)L.push("Discount -"+dc);if(pv)L.push("Purana baqaya +"+pv)}
  $("brk").textContent=L.join("  ·  ");
}
function bikeInfo(){
  const k=norm(cj.bike),h=$("hist");h.innerHTML="";
  const bb=bikeBills();
  if(bb.length){
    const tot=bb.reduce((t,b)=>t+net(b),0);
    const d=document.createElement("details");d.className="hist";
    const s=document.createElement("summary");s.textContent="Pehle "+bb.length+" bar aayi · kul Rs "+tot;d.append(s);
    bb.slice(0,20).forEach(b=>{const p=document.createElement("div");p.className="hl";
      p.textContent=fmtD(new Date(b.created_at))+" · Rs "+net(b)+" · "+[...b.work,...b.parts].map(qn).join(", ");d.append(p)});
    h.append(d);
  }
  const dd=cj.editId?0:bikeDue();
  $("prevBox").hidden=!(dd>0);
  if(dd>0)$("prevTxt").textContent="⚠️ Pehle ka baqaya Rs "+dd+". Shamil karein";
}
function billDetails(x){
  const d=document.createElement("details"),s=document.createElement("summary");
  const dd=due(x);
  s.textContent=(x.bike||"-")+" · "+fmtT(new Date(x.created_at))+" · Rs "+(net(x)+(x.prev_due||0))+(dd?" · baqaya "+dd:"")+(x.pending?" ⏳":"");
  d.append(s);
  if(x.cust_name||x.cust_phone){const c=document.createElement("div");c.className="hint";c.textContent="👤 "+(x.cust_name||"")+" "+(x.cust_phone||"");d.append(c)}
  [...x.work.map(i=>["🔧",i]),...x.parts.map(i=>["⚙️",i])].forEach(([ic,i])=>{
    const p=document.createElement("div");p.style.cssText="font-size:18px;padding:4px 0 4px 12px";p.textContent=ic+" "+qn(i)+(i.o?" 🌐":"")+" — "+i.p;d.append(p)});
  if(x.discount||x.prev_due){const p=document.createElement("div");p.className="hint";p.textContent=(x.discount?"Discount -"+x.discount+"  ":"")+(x.prev_due?"Purana baqaya +"+x.prev_due:"");d.append(p)}
  const r=document.createElement("div");r.className="row";
  r.append(btn("🖨️",async()=>{try{say("Print ho raha hai...");await printCV(drawBill(x));say("Dobara print ho gaya ✔")}catch(e){say("Print nahi hua: "+(e.message||e))}}));
  if(ME&&ME.tts&&voiceOK())r.append(btn("🔊",()=>speakBill(x)));
  r.append(btn("📲",()=>wa(x.cust_phone,billText(x))));
  if(!x.pending){r.append(btn("✏️",()=>editBill(x)),delBtn(x))}
  d.append(r);return d;
}
function render(){
  renderTabs();
  list($("work"),cj.work);list($("parts"),cj.parts);calc();bikeInfo();
  const now=new Date();$("calM").textContent=MON[now.getMonth()].toUpperCase();$("calD").textContent=now.getDate();
  const day=dk(now),t=bills.filter(x=>dk(new Date(x.created_at))===day);
  $("today").textContent=t.length+" bike aaj";
  const tl=$("todayList");tl.innerHTML="";t.forEach(x=>tl.append(billDetails(x)));
  renderAll();
  const pc=pendList().length,pb=$("pendBar");pb.hidden=!pc;
  if(pc)pb.textContent="⏳ "+pc+" bill internet ka intezar kar rahi hain. Net aate hi khud chali jayengi.";
  if(typeof ownRender==="function")ownRender();
}
$("bike").oninput=e=>{e.target.value=e.target.value.toUpperCase();keep();render()};
["cName","cPhone","paid","nextS","disc"].forEach(id=>{$(id).oninput=()=>{keep();calc();if(id==="cPhone")phCheck()};$(id).onchange=$(id).oninput});
$("takePrev").onchange=()=>{keep();calc()};
function phCheck(){const d=$("cPhone").value.replace(/\D/g,"");$("phHint").textContent=d&&d.length!==11?"Number "+d.length+" ank ka hai. 11 ank hone chahiye (03xx...)":""}
async function addFrom(inp,arr,isParts){
  const v=inp.value.trim();if(!v){inp.focus();return}
  const it=parseItem(v);if(isParts)await resolveBrand(it);
  arr.push(it);inp.value="";keep();render();
}
$("addWork").onclick=()=>addFrom($("workIn"),cj.work,false);
$("addPart").onclick=()=>addFrom($("partIn"),cj.parts,true);
$("workIn").onkeydown=e=>{if(e.key==="Enter")addFrom($("workIn"),cj.work,false)};
$("partIn").onkeydown=e=>{if(e.key==="Enter")addFrom($("partIn"),cj.parts,true)};
$("clear").onclick=()=>{addJob()};
$("waNow").onclick=()=>{
  if(!cj.work.length&&!cj.parts.length){say("Pehle kaam ya parts daalein");return}
  readFields();
  const ph=cj.phone.replace(/\D/g,"");
  if(ph.length<10){say("Pehle customer ka phone number likhein");$("cPhone").focus();return}
  wa(ph,billText({bike:cj.bike,work:cj.work,parts:cj.parts,total:total(),discount:discV(),prev_due:prevV(),paid:$("paid").value===""?null:paidV(),cust_name:cj.name.trim(),created_at:Date.now()}));
};
$("save").onclick=async()=>{try{if(await saveBill())say("Bill save ho gayi ✔. Purane Bills mein dekh sakte hain")}catch(e){say("Save nahi hua: "+e.message)}};

/* ---------- purane bills: tareekh ke hisaab se ---------- */
const waNum=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d="92"+d.slice(1);return d};
const wa=(phone,text)=>{location.href="https://wa.me/"+waNum(phone)+"?text="+encodeURIComponent(text)};
const shopHead=()=>{const L=["*"+SHOP+"*"];if(ME&&ME.phone)L.push("Phone: "+ME.phone);if(ME&&ME.address)L.push(ME.address);return L};
const billText=b=>{
  const L=[...shopHead(),fmtD(new Date(b.created_at||Date.now())),"Bike: "+(b.bike||"-")];
  if(b.cust_name)L.push("Customer: "+b.cust_name);
  if(b.work.length){L.push("","Kaam:");b.work.forEach(x=>L.push("- "+x.n+": "+x.p))}
  if(b.parts.length){L.push("","Parts:");b.parts.forEach(x=>L.push("- "+qn(x)+": "+x.p))}
  const dc=b.discount||0,pv=b.prev_due||0,pay=b.total-dc+pv;
  L.push("");
  if(dc||pv){L.push("Bill: Rs "+b.total);if(dc)L.push("Discount: -Rs "+dc);if(pv)L.push("Purana baqaya: +Rs "+pv)}
  L.push("*Total: Rs "+pay+"*");
  if(b.paid!=null&&b.paid<pay)L.push("Mile: Rs "+b.paid,"Baqaya: Rs "+(pay-b.paid));
  L.push("Shukriya!");return L.join("\n");
};
function editBill(x){
  cj.bike=x.bike||"";cj.work=x.work.map(i=>({...i}));cj.parts=x.parts.map(i=>({...i}));
  cj.name=x.cust_name||"";cj.phone=x.cust_phone||"";cj.disc=x.discount?String(x.discount):"";
  const pay=net(x)+(x.prev_due||0);cj.paid=x.paid!=null&&x.paid<pay?String(x.paid):"";
  cj.editId=x.id;cj.prevKeep=x.prev_due||0;cj.nextS="";
  writeFields();saveJobs();render();window.scrollTo(0,0);say("Theek karke 'Sirf Save' dabayein");
}
function delBtn(x){
  const b=btn("🗑️",async()=>{
    if(!b.dataset.s){b.dataset.s=1;b.textContent="Pakka?";b.style.background="#b42318";
      setTimeout(()=>{b.dataset.s="";b.textContent="🗑️";b.style.background=""},4000);return}
    try{await stockApply(x.parts,1,"undo");await db("bills?id=eq."+x.id,{method:"DELETE"});await loadBills();say("Bill mita di ✔")}
    catch(e){say("Nahi mita: "+e.message)}
  });
  return b;
}
function dayLine(list2){
  const T={m:0,po:0,pq:0,dc:0,n:list2.length,net:0,paid:0};
  list2.forEach(b=>{T.m+=sumP(b.work);T.po+=sumP(b.parts.filter(x=>!x.o));T.pq+=sumP(b.parts.filter(x=>x.o));T.dc+=b.discount||0;T.net+=net(b);T.paid+=b.paid==null?net(b)+(b.prev_due||0):b.paid});
  return T;
}
function renderAll(){
  const el=$("all");el.innerHTML="";
  const k=norm(cj.bike),b=k?bills.filter(x=>norm(x.bike)===k):bills;
  $("allHint").textContent=k?"Sirf is bike ki bills ("+b.length+")":(b.length?"Tareekh par dabayein. Bike number likhein to sirf us ki dikhengi":"Abhi koi bill save nahi hui");
  const g={},order=[];
  b.forEach(x=>{const d=dk(new Date(x.created_at));if(!g[d]){g[d]=[];order.push(d)}g[d].push(x)});
  order.slice(0,datesShown).forEach(d=>{
    const arr=g[d],det=document.createElement("details"),s=document.createElement("summary");
    s.textContent=fmtD(new Date(d+"T12:00:00"))+" · "+arr.length+" bike";det.append(s);
    let built=false;
    det.ontoggle=()=>{
      if(!det.open||built)return;built=true;
      if(unlocked){
        const T=dayLine(arr),box=document.createElement("div");
        [["🔧 Mazdoori",T.m],["⚙️ Parts",T.po],["🌐 Bahar ka saman",T.pq],["Discount",-T.dc],["Kul kaam",T.net],["Jeb mein aaye",T.paid]].forEach(([a,v])=>{
          const r=document.createElement("div");r.className="kv";r.innerHTML="<span></span><b></b>";r.children[0].textContent=a;r.children[1].textContent="Rs "+v;box.append(r)});
        det.append(box);
      }
      arr.forEach(x=>det.append(billDetails(x)));
    };
    el.append(det);
  });
  $("moreDates").hidden=order.length<=datesShown;
}
$("moreDates").onclick=()=>{datesShown+=31;renderAll()};

/* ---------- awaaz (OpenAI, server ke raste) ---------- */
async function aiFetch(path,init){
  await ensure();
  let r=null;
  try{r=await fetch(SUPA+"/functions/v1/ai",{method:"POST",headers:{apikey:ANON,Authorization:"Bearer "+S.access_token,"x-path":path,...(init.headers||{})},body:init.body})}catch(e){r=null}
  if(r&&r.status!==404)return r;
  if(OAI)return fetch("https://api.openai.com/v1/"+path,{method:"POST",headers:{...(init.headers||{}),Authorization:"Bearer "+OAI},body:init.body});
  if(r)return r;
  throw new Error("Internet nahi hai");
}
async function oai(path,opts){
  const r=await aiFetch(path,opts);
  if(!r.ok){let m="";try{m=(await r.json()).error.message}catch(e){}
    throw new Error(r.status===401?"OpenAI key ghalat hai":r.status===403?"Awaaz is dukaan ke liye band hai":r.status===429?"OpenAI credit khatam ya bohat tez":("Error "+r.status+" "+m))}
  return r.json();
}
async function tr(blob,prompt,lang){
  const ext=/mp4|m4a|aac/.test(blob.type)?"m4a":/ogg/.test(blob.type)?"ogg":"webm";
  const fd=new FormData();fd.append("file",blob,"a."+ext);fd.append("model",M_TR);fd.append("prompt",prompt);if(lang)fd.append("language",lang);
  return (await oai("audio/transcriptions",{method:"POST",body:fd})).text||"";
}
async function ask(sys,text){
  let last;
  for(const m of ["gpt-4o",M_CH]){
    try{
      const j=await oai("chat/completions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:m,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:sys},{role:"user",content:text}]})});
      return JSON.parse(j.choices[0].message.content);
    }catch(e){last=e;if(/ghalat|credit|band hai/.test(e.message))break}
  }
  throw last;
}
let spk=null;
async function speakText(txt){
  const r=await aiFetch("audio/speech",{headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini-tts",voice:"alloy",input:txt,instructions:"Speak in Urdu, slowly and clearly, like a shopkeeper reading out to a customer.",response_format:"mp3"})});
  if(!r.ok)throw new Error(r.status===403?"Awaaz is dukaan ke liye band hai":r.status===401?"OpenAI key ghalat hai":r.status===429?"OpenAI credit khatam":("Error "+r.status));
  const au=new Audio(URL.createObjectURL(await r.blob()));spk=au;
  au.onended=()=>{spk=null;say("Tayyar")};
  await au.play();say("Sunaya ja raha hai... (dobara dabayein to band)");
}
function stopSpeak(){if(spk){spk.pause();spk=null;say("Band");return true}return false}
async function speakSentence(sys,data,fallback){
  if(stopSpeak())return;
  if(!voiceOK()){say("Awaaz is dukaan ke liye chalu nahi");return}
  try{
    say("Awaaz taiyar ho rahi hai...");
    let txt;try{txt=(await ask(sys,JSON.stringify(data))).say}catch(e){txt=null}
    await speakText(txt||fallback);
  }catch(e){spk=null;say("Awaaz nahi aayi: "+(e.message||e))}
}
function speakBill(b){
  b=b||{bike:cj.bike,work:cj.work,parts:cj.parts,total:total(),discount:discV(),prev_due:prevV(),paid:$("paid").value===""?null:paidV()};
  if(!b.work.length&&!b.parts.length){say("Pehle kaam ya parts daalein");return}
  const pay=b.total-(b.discount||0)+(b.prev_due||0);
  const data={bike:b.bike,jobs:b.work.map(x=>({name:x.n,price:x.p})),parts:b.parts.map(x=>({name:x.n,company:x.c||"",qty:x.q||1,price:x.p})),discount:b.discount||0,old_balance:b.prev_due||0,total_to_pay:pay,still_owed:b.paid!=null&&b.paid<pay?pay-b.paid:0};
  speakSentence(TTSYS,data,"Bike "+data.bike+". Total "+pay+" rupay.");
}
$("speak").onclick=()=>speakBill();

function recOnce(btn2,cb,ms){
  if(btn2._r){btn2._r.stop();return}
  if(!voiceOK()){say("Awaaz is dukaan ke liye chalu nahi. Service dene wale se rabta karein.");return}
  navigator.mediaDevices.getUserMedia({audio:true}).then(st=>{
    const ch=[],mr=new MediaRecorder(st);btn2._r=mr;
    mr.ondataavailable=e=>ch.push(e.data);
    mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());btn2._r=null;btn2.textContent="🎤";
      try{say("Samajh raha hoon...");await cb(new Blob(ch,{type:mr.mimeType||"audio/webm"}))}catch(e){say("AI masla: "+e.message)}};
    setTimeout(()=>{if(btn2._r===mr)mr.stop()},ms||30000);
    mr.start();btn2.textContent="⏹";say("Bolain, phir dobara dabayein");
  }).catch(()=>say("Mic ki ijazat dein: address bar ke paas nishan > Permissions > Microphone > Allow"));
}
$("mic").onclick=()=>recOnce($("mic"),async blob=>{
  const t=await tr(blob,HINT);
  if(!t.trim()){say("Kuch suna nahi, dobara bolain");return}
  const o=await ask(SYS,t),bk=cleanBike(o.bike);
  if(bk)cj.bike=bk;
  (o.work||[]).forEach(i=>cj.work.push(it2(i)));
  for(const i of o.parts||[]){const x=it3(i);await resolveBrand(x);cj.parts.push(x)}
  writeFields();keep();render();say("Suna: "+t);
});
$("bikeMic").onclick=()=>recOnce($("bikeMic"),async blob=>{
  const t=await tr(blob,BIKEHINT,"en"),o=await ask(BIKESYS,t),bk=cleanBike(o.bike);
  if(bk){cj.bike=bk;writeFields();keep();render()}
  say("Bike: "+(bk||"samajh nahi aaya")+"  (suna: "+t+")");
},12000);
$("workMic").onclick=()=>recOnce($("workMic"),async blob=>{
  const t=await tr(blob,HINT);if(!t.trim()){say("Kuch suna nahi, dobara bolain");return}
  const o=await ask(WSYS,t);(o.work||[]).forEach(i=>cj.work.push(it2(i)));
  keep();render();say("Suna: "+t);
},20000);
$("partMic").onclick=()=>recOnce($("partMic"),async blob=>{
  const t=await tr(blob,HINT);if(!t.trim()){say("Kuch suna nahi, dobara bolain");return}
  const o=await ask(PSYS,t);
  for(const i of o.parts||[]){const x=it3(i);await resolveBrand(x);cj.parts.push(x)}
  keep();render();say("Suna: "+t);
},20000);
$("cNameMic").onclick=()=>recOnce($("cNameMic"),async blob=>{
  const t=await tr(blob,"A person's name, Pakistani.");const o=await ask(NAMESYS,t);
  if(o.name){$("cName").value=o.name;keep()}say("Naam: "+(o.name||"samajh nahi aaya"));
},10000);
$("cPhoneMic").onclick=()=>recOnce($("cPhoneMic"),async blob=>{
  const t=await tr(blob,"Pakistani mobile number, digits. Example 0300 1234567.","en");const o=await ask(PHONESYS,t);
  const d=String(o.phone||"").replace(/\D/g,"");
  if(d){$("cPhone").value=d;keep();phCheck()}say("Number: "+(d||"samajh nahi aaya")+" (theek hai to rehne dein, warna badal lein)");
},15000);

/* ---------- printing (58mm thermal, Bluetooth) ---------- */
function drawBill(b){
  b=b||{bike:cj.bike,work:cj.work,parts:cj.parts,total:total(),discount:discV(),prev_due:prevV(),cust_name:$("cName").value.trim(),paid:$("paid").value===""?null:paidV(),created_at:Date.now()};
  const W=384,pad=8,lh=34,L=[],dt=new Date(b.created_at);
  const dc=b.discount||0,pv=b.prev_due||0,pay=b.total-dc+pv;
  L.push({t:SHOP,c:1,b:1,big:1});
  if(ME&&ME.phone)L.push({t:ME.phone,c:1});
  if(ME&&ME.address)L.push({t:ME.address,c:1});
  L.push({t:fmtD(dt)+" "+fmtT(dt),c:1});
  L.push({t:"Bike: "+(b.bike||"-"),b:1,big:1});
  if(b.cust_name)L.push({t:"Customer: "+b.cust_name});
  L.push({t:"--------------------------------",c:1});
  if(b.work.length){L.push({t:"KAAM",b:1});b.work.forEach(x=>L.push({t:x.n,r:String(x.p)}))}
  if(b.parts.length){L.push({t:"PARTS",b:1});b.parts.forEach(x=>L.push({t:qn(x),r:String(x.p)}))}
  L.push({t:"--------------------------------",c:1});
  if(dc||pv){L.push({t:"Bill",r:String(b.total)});if(dc)L.push({t:"Discount",r:"-"+dc});if(pv)L.push({t:"Purana baqaya",r:"+"+pv})}
  L.push({t:"TOTAL",r:"Rs "+pay,b:1,big:1});
  if(b.paid!=null&&b.paid<pay){L.push({t:"Mile",r:"Rs "+b.paid});L.push({t:"Baqaya",r:"Rs "+(pay-b.paid),b:1})}
  L.push({t:"Shukriya!",c:1});
  const H=L.length*lh+pad*2+20,cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const g=cv.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,W,H);g.fillStyle="#000";g.textBaseline="middle";
  L.forEach((l,i)=>{const y=pad+i*lh+lh/2;g.font=(l.b?"bold ":"")+(l.big?26:22)+"px sans-serif";
    if(l.c){g.textAlign="center";g.fillText(l.t,W/2,y,W-pad*2)}
    else{g.textAlign="left";g.fillText(l.t,pad,y,l.r?W-140:W-pad*2);if(l.r){g.textAlign="right";g.fillText(l.r,W-pad,y)}}});
  return cv;
}
function toRaster(cv){
  const W=cv.width,H=cv.height,bpr=W/8,px=cv.getContext("2d").getImageData(0,0,W,H).data,out=[];
  for(let y0=0;y0<H;y0+=100){
    const h=Math.min(100,H-y0),buf=new Uint8Array(8+bpr*h);buf.set([0x1d,0x76,0x30,0,bpr&255,bpr>>8,h&255,h>>8]);
    for(let y=0;y<h;y++)for(let x=0;x<W;x++){const i=((y0+y)*W+x)*4;if(px[i]*0.3+px[i+1]*0.59+px[i+2]*0.11<140)buf[8+y*bpr+(x>>3)]|=0x80>>(x&7)}
    out.push(buf);
  }
  return out;
}
const SVC=["000018f0-0000-1000-8000-00805f9b34fb","0000ff00-0000-1000-8000-00805f9b34fb","e7810a71-73ae-499d-8c15-faa9aef0c3f2","49535343-fe7d-4ae5-8fa9-9fafd205e455","0000ffe0-0000-1000-8000-00805f9b34fb","0000fee7-0000-1000-8000-00805f9b34fb"];
let btDev=null,btChar=null;
async function connectPrinter(){
  if(btChar&&btDev&&btDev.gatt.connected)return;
  if(!navigator.bluetooth)throw new Error("Bluetooth is browser mein nahi");
  if(!btDev)btDev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:SVC});
  const s=await btDev.gatt.connect();
  for(const svc of await s.getPrimaryServices())for(const c of await svc.getCharacteristics())if(c.properties.write||c.properties.writeWithoutResponse){btChar=c;return}
  throw new Error("Printer ka write port nahi mila");
}
async function send(d){for(let i=0;i<d.length;i+=100){const c=d.slice(i,i+100);if(btChar.properties.writeWithoutResponse)await btChar.writeValueWithoutResponse(c);else await btChar.writeValue(c);await sleep(25)}}
async function printCV(cv){
  try{await connectPrinter();await send(new Uint8Array([0x1b,0x40]));
    for(const s of toRaster(cv))await send(s);
    await send(new Uint8Array([0x1b,0x64,5]));
  }catch(e){btChar=null;throw e}
}
$("print").onclick=async()=>{
  if(!cj.work.length&&!cj.parts.length){say("Pehle kaam ya parts daalein");return}
  try{
    say("Printer se jud raha hai...");await printCV(drawBill());
    try{await saveBill();say("Bill print aur save ho gayi ✔")}catch(e){say("Print ho gaya, lekin save nahi hui: "+e.message)}
  }catch(e){say(e&&e.name==="NotFoundError"?"Printer chuna nahi gaya":"Print nahi hua: "+(e.message||e))}
};

/* ---------- naya version, offline ---------- */
async function checkVersion(){
  try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});const j=await r.json();if(j.v>VER)$("upd").hidden=false}catch(e){}
}
$("updGo").onclick=async()=>{
  try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}catch(e){}
  location.reload();
};
function boot(){
  if(/[?&]login(&|=|$)/.test(location.search)){S=null;ls.del("sess");ls.del("me_cache");try{history.replaceState(null,"",location.pathname)}catch(e){}}
  show();checkVersion();
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
}
