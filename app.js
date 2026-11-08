"use strict";
/* ===== Workshop Bill: multi-dukaan version ===== */
const SUPA="https://nkfxdznmzsrsircqutda.supabase.co";
const ANON="sb_publishable_IpyjtvFcq_gEgw4w5TBhyg_i4uOpJ6O";
const M_TR="gpt-4o-transcribe",M_CH="gpt-4o-mini";
const HINT="Motorcycle workshop in Pakistan. Words: chain kasna, brake shoe, clutch plate, spark plug, tyre, tube, engine oil, oil filter, air filter, kick, self start, carburetor, piston, cylinder, bearing, cable, mirror, indicator, battery, mazdoori, mobile oil. Bike plate like RNE 8485. Numbers are prices in rupees.";
const SYS='You help a motorcycle mechanic in Pakistan who speaks Urdu, Hindi or English mixed. Extract from the transcript: (1) the bike plate. Pakistani plates are 2 to 4 capital letters then 2 to 4 digits, for example RNE 8485, LEB 1234, ABC 123. Digits are often said in pairs, so "84 85" or "eighty four eighty five" means 8485. Join all digits and never drop any. (2) labour jobs, meaning a charge for work like chain kasna, tuning, service, or just mazdoori. If the job is only a labour or mazdoori charge, name it exactly "Labour". (3) spare parts or oil bought. Give each job and part its price in rupees (integer, 0 if not said). Never mix plate digits with prices. Write names in short English or Roman Urdu using Latin letters. For parts also give qty (pieces, default 1). If he says a number of pieces before or after the part name (do, teen, 2, 3, "two spark plugs"), set qty to that number. The price you return is always the total for that whole line: if he says the price is per piece (har ek, ek ka, each), multiply it by qty. Example: "do spark plug 300" means qty 2, price 300. If a part is bought from another shop (bahar se, mohalle se, dukaan se) set outside true and shop to that shop name. Return JSON only: {"bike":"","work":[{"name":"","price":0}],"parts":[{"name":"","price":0,"qty":1,"outside":false,"shop":""}]}';
const BIKESYS='The text is a spoken Pakistani motorcycle number plate: 2 to 4 capital letters then 2 to 4 digits, for example RNE 8485 or LEB 1234. Digits may be said in pairs, so "84 85" means 8485. Join all digits and never drop any. Return JSON only: {"bike":"RNE8485"}';
const BIKEHINT="Pakistani motorcycle number plate, letters then digits. Examples: RNE 8485, LEB 1234, LEA 5678, ABC 1234, RIV 9021.";
const STSYS='A motorcycle mechanic in Pakistan says stock items he added to his shop, each with how many pieces, and sometimes the buying price. Names in short English or Roman Urdu using Latin letters. cost is the buying price of ONE piece in rupees (0 if not said; if he gives one price for all pieces together, divide by qty). Return JSON only: {"items":[{"name":"","qty":0,"cost":0}]}';
const WSYS='A motorcycle mechanic in Pakistan (Urdu, Hindi, English mixed) says labour jobs with prices. If a job is only a labour or mazdoori charge, name it exactly "Labour". Names in short English or Roman Urdu using Latin letters. Price in rupees, integer, 0 if not said. Return JSON only: {"work":[{"name":"","price":0}]}';
const PSYS='A motorcycle mechanic in Pakistan (Urdu, Hindi, English mixed) says spare parts or oil with prices. Names in short English or Roman Urdu using Latin letters. Give qty (pieces, default 1). If he says a number of pieces before or after the part name (do, teen, 2, 3), set qty to that number. The price is always the total for that whole line: if he says the price is per piece (har ek, ek ka, each), multiply by qty. Example: "do spark plug 300" means qty 2, price 300. If a part is bought from another shop (bahar se, mohalle se, dukaan se) set outside true and shop to that shop name. Return JSON only: {"parts":[{"name":"","price":0,"qty":1,"outside":false,"shop":""}]}';
const TTSYS='You write what a text-to-speech voice reads aloud to an unlettered Pakistani motorcycle customer to confirm his bill. Use simple spoken Urdu in Urdu script. Say the bike plate letter by letter and digits one by one. Write every number in Urdu words. Say each job and part with its price (and quantity when more than 1), then the total, and the amount still owed if any. Keep it short and clear. Return JSON only: {"say":""}';
const MERGE={Prefer:"resolution=merge-duplicates,return=minimal"},MIN={Prefer:"return=minimal"};

const $=id=>document.getElementById(id);
const ls={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const say=t=>{$("bar").textContent=t};
const AR="٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const fix=s=>s.replace(/[٠-٩۰-۹]/g,c=>String(AR.indexOf(c)%10));
const norm=s=>(s||"").toUpperCase().replace(/[^\p{L}\p{N}]/gu,"");
const sk=n=>String(n||"").toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g," ").replace(/\s+/g," ").trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LIM=()=>+(ls.get("lim",5))||5;
let S=ls.get("sess",null),ME=null,SHOP="",OAI="",pinHash="";
let bike="",work=[],parts=[],bills=[],stk=[],outs=[];
let saved=false,started=false,editId=null,unlocked=false;

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
    catch(e){if(/fetch|network/i.test(e.message))throw new Error("Internet nahi hai");logout();throw new Error("Dobara login karein")}
  }
}
function logout(){S=null;ME=null;started=false;unlocked=false;bills=[];stk=[];outs=[];ls.del("sess");show()}
async function db(path,opts={}){
  await ensure();
  const r=await fetch(SUPA+"/rest/v1/"+path,{...opts,headers:{apikey:ANON,Authorization:"Bearer "+S.access_token,"Content-Type":"application/json",...(opts.headers||{})}});
  const t=await r.text();
  if(!r.ok){let m=t;try{m=JSON.parse(t).message||t}catch(e){}throw new Error(m)}
  return t?JSON.parse(t):null;
}
const rpc=(name,body)=>db("rpc/"+name,{method:"POST",body:JSON.stringify(body||{})});
function show(){$("login").hidden=!!S;if(!S){$("app").hidden=true;$("noshop").hidden=true}else start()}
$("go").onclick=async()=>{
  $("lerr").textContent="";
  try{await tokenReq({email:$("em").value.trim(),password:$("pw").value},"password");show()}
  catch(e){$("lerr").textContent=/invalid/i.test(e.message)?"Email ya password ghalat hai":/fetch/i.test(e.message)?"Internet nahi hai":e.message}
};
$("pw").onkeydown=e=>{if(e.key==="Enter")$("go").click()};
$("logout").onclick=logout;$("logout2").onclick=logout;

async function start(){
  if(started)return;started=true;
  try{ME=await rpc("me")}catch(e){started=false;say("Dukaan ki maloomat nahi aayi: "+e.message);return}
  if(!ME){$("app").hidden=true;$("noshop").hidden=false;return}
  $("noshop").hidden=true;$("app").hidden=false;
  SHOP=String(ME.name||"").toUpperCase();OAI=ME.openai_key||"";pinHash=ME.pin||"";keyNote();
  applyFlags();$("shopName").textContent=ME.name;$("adminCard").hidden=!ME.is_admin;
  document.title=ME.name;
  const d=ls.get("draft_"+ME.shop_id,{});bike=d.bike||"";work=d.work||[];parts=d.parts||[];$("bike").value=bike;
  render();
  try{await loadBills()}catch(e){say("History nahi aayi: "+e.message)}
  if(ME.is_admin)loadShops();
}

function applyFlags(){$("speak").hidden=!(ME&&ME.tts);render()}

/* ---------- bill data ---------- */
const keep=()=>{saved=false;if(ME)ls.set("draft_"+ME.shop_id,{bike,work,parts})};
const total=()=>[...work,...parts].reduce((a,x)=>a+(+x.p||0),0);
const stockMatch=n=>{const k=sk(n);if(k.length<3)return null;return stk.find(s=>s.name===k)||stk.find(s=>Math.min(s.name.length,k.length)>=4&&(s.name.includes(k)||k.includes(s.name)))||null};
const strip=a=>a.map(x=>({n:x.n,p:x.p,...(x.q>1?{q:x.q}:{}),...(x.o?{o:1,s:x.s||""}:{})}));
const addM=m=>{const d=new Date();d.setMonth(d.getMonth()+(+m));return d.toISOString().slice(0,10)};
const qn=x=>(x.q>1?x.q+" x ":"")+x.n;
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
const it3=i=>({...it2(i),...(i.qty>1?{q:Math.round(i.qty)}:{}),...(i.outside?{o:1,s:String(i.shop||"")}:{})});
const cleanBike=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");

async function loadBills(){
  bills=await db("bills?select=*&order=created_at.desc&limit=300")||[];
  try{stk=await db("stock?select=*&order=name")||[]}catch(e){stk=[]}
  if(unlocked)await refreshOuts();
  render();
}
async function stockApply(items,sign){
  for(const x of items){
    if(x.o)continue;
    const s=stockMatch(x.n);if(!s)continue;
    s.qty=Math.max(0,s.qty+sign*(x.q||1));
    await db("stock?name=eq."+encodeURIComponent(s.name),{method:"PATCH",headers:MIN,body:JSON.stringify({qty:s.qty})});
  }
}
async function saveBill(){
  if(!work.length&&!parts.length){say("Pehle kaam ya parts daalein");return false}
  if(saved)return true;
  const tt=total(),pv=$("paid").value,paid=pv===""?tt:Math.max(0,Math.min(tt,+pv||0));
  const row={bike:bike.trim(),work:strip(work),parts:strip(parts),total:tt,cust_name:$("cName").value.trim(),cust_phone:$("cPhone").value.trim(),paid,next_service:$("nextS").value?addM($("nextS").value):null};
  if(editId){
    const old=bills.find(b=>b.id===editId);if(old)await stockApply(old.parts,1);
    await db("bills?id=eq."+editId,{method:"PATCH",headers:MIN,body:JSON.stringify(row)});
  }else{
    await db("bills",{method:"POST",headers:MIN,body:JSON.stringify(row)});
    for(const x of parts.filter(p=>p.o))await db("outside",{method:"POST",headers:MIN,body:JSON.stringify({bike:row.bike,item:x.n,shop:x.s||"",price:x.p})});
  }
  await stockApply(parts,-1);
  saved=true;editId=null;await loadBills();return true;
}

/* ---------- screen ---------- */
function list(el,arr){
  el.innerHTML="";
  const isP=arr===parts;
  arr.forEach((it,i)=>{
    const d=document.createElement("div");d.className="item";
    const n=document.createElement("div");n.className="n";n.textContent=qn(it)+(it.o?" 🌐":"");
    const p=document.createElement("input");p.type="number";p.inputMode="numeric";p.value=it.p;
    p.oninput=()=>{it.p=+p.value||0;keep();$("total").textContent="Total: "+total()};
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

function render(){
  list($("work"),work);list($("parts"),parts);$("total").textContent="Total: "+total();
  const day=new Date().toDateString(),t=bills.filter(x=>new Date(x.created_at).toDateString()===day);
  $("today").textContent=t.length+" bike · Rs "+t.reduce((a,x)=>a+x.total,0);
  const k=norm(bike),b=k?bills.filter(x=>norm(x.bike)===k):bills;
  $("allHint").textContent=k?"Sirf is bike ki bills ("+b.length+")":(b.length?"Aakhri bills (bike number likhein to sirf us ki dikhengi)":"Abhi koi bill save nahi hui");
  renderAll(b);
  $("hist").innerHTML="";
  if(k&&b.length){const l=b[0],d=document.createElement("div");d.className="hist";
    d.textContent="Pehle "+b.length+" bar aayi. Akhri: "+new Date(l.created_at).toLocaleDateString()+" · Rs "+l.total+" · "+[...l.work,...l.parts].map(x=>x.n).join(", ");$("hist").append(d)}
  ownRender();
}
$("bike").oninput=e=>{bike=e.target.value.toUpperCase();keep();render()};
function addFrom(inp,arr){const v=inp.value.trim();if(!v){inp.focus();return}arr.push(parseItem(v));inp.value="";keep();render()}
$("addWork").onclick=()=>addFrom($("workIn"),work);
$("addPart").onclick=()=>addFrom($("partIn"),parts);
$("workIn").onkeydown=e=>{if(e.key==="Enter")addFrom($("workIn"),work)};
$("partIn").onkeydown=e=>{if(e.key==="Enter")addFrom($("partIn"),parts)};
$("clear").onclick=()=>{
  bike="";work=[];parts=[];editId=null;saved=false;
  $("bike").value="";$("cName").value="";$("cPhone").value="";$("paid").value="";$("nextS").value="3";
  if(ME)ls.del("draft_"+ME.shop_id);render();say("Nayi bike");
};
$("save").onclick=async()=>{try{if(await saveBill())say("Bill save ho gaya ✔")}catch(e){say("Save nahi hua: "+e.message)}};

/* ---------- purani bills: print, WhatsApp, theek, mitao ---------- */
const waNum=p=>{let d=String(p||"").replace(/\D/g,"");if(d.startsWith("0"))d="92"+d.slice(1);return d};
const wa=(phone,text)=>{location.href="https://wa.me/"+waNum(phone)+"?text="+encodeURIComponent(text)};
const billText=b=>{
  const L=["*"+SHOP+"*",new Date(b.created_at||Date.now()).toLocaleDateString(),"Bike: "+(b.bike||"-")];
  if(b.work.length){L.push("","Kaam:");b.work.forEach(x=>L.push("- "+x.n+": "+x.p))}
  if(b.parts.length){L.push("","Parts:");b.parts.forEach(x=>L.push("- "+qn(x)+": "+x.p))}
  L.push("","*Total: Rs "+b.total+"*");
  if(b.paid!=null&&b.paid<b.total)L.push("Baqaya: Rs "+(b.total-b.paid));
  L.push("Shukriya!");return L.join("\n");
};
function editBill(x){
  bike=x.bike||"";$("bike").value=bike;work=x.work.map(i=>({...i}));parts=x.parts.map(i=>({...i}));
  $("cName").value=x.cust_name||"";$("cPhone").value=x.cust_phone||"";
  $("paid").value=x.paid!=null&&x.paid<x.total?x.paid:"";
  editId=x.id;keep();render();window.scrollTo(0,0);say("Theek karke 'Sirf Save' dabayein");
}
function delBtn(x){
  const b=btn("🗑️",async()=>{
    if(!b.dataset.s){b.dataset.s=1;b.textContent="Pakka?";b.style.background="#b42318";
      setTimeout(()=>{b.dataset.s="";b.textContent="🗑️";b.style.background=""},4000);return}
    try{await stockApply(x.parts,1);await db("bills?id=eq."+x.id,{method:"DELETE"});await loadBills();say("Bill mita di ✔")}
    catch(e){say("Nahi mita: "+e.message)}
  });
  return b;
}
function renderAll(b){
  const el=$("all");el.innerHTML="";
  b.slice(0,40).forEach(x=>{
    const d=document.createElement("details"),s=document.createElement("summary");
    const due=x.paid!=null&&x.paid<x.total;
    s.textContent=(x.bike||"-")+" · "+new Date(x.created_at).toLocaleDateString()+" · Rs "+x.total+(due?" · baqaya "+(x.total-x.paid):"");
    d.append(s);
    if(x.cust_name||x.cust_phone){const c=document.createElement("div");c.className="hint";c.textContent="👤 "+(x.cust_name||"")+" "+(x.cust_phone||"");d.append(c)}
    [...x.work.map(i=>["🔧",i]),...x.parts.map(i=>["⚙️",i])].forEach(([ic,i])=>{
      const p=document.createElement("div");p.style.cssText="font-size:18px;padding:4px 0 4px 12px";p.textContent=ic+" "+qn(i)+(i.o?" 🌐":"")+" — "+i.p;d.append(p)});
    const r=document.createElement("div");r.className="row";
    r.append(
      btn("🖨️",async()=>{try{say("Print ho raha hai...");await printCV(drawBill(x));say("Dobara print ho gaya ✔")}catch(e){say("Print nahi hua: "+(e.message||e))}}),
      ...(ME&&ME.tts?[btn("🔊",()=>speakBill(x))]:[]),
      btn("📲",()=>wa(x.cust_phone,billText(x))),
      btn("✏️",()=>editBill(x)),
      delBtn(x));
    d.append(r);el.append(d);
  });
}

/* ---------- awaaz (OpenAI) ---------- */
async function oai(path,opts){
  const r=await fetch("https://api.openai.com/v1/"+path,{...opts,headers:{...(opts.headers||{}),Authorization:"Bearer "+OAI}});
  if(!r.ok){let m="";try{m=(await r.json()).error.message}catch(e){}
    throw new Error(r.status===401?"OpenAI key ghalat hai":r.status===429?"OpenAI credit khatam ya bohat tez":("Error "+r.status+" "+m))}
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
    }catch(e){last=e;if(/ghalat|credit/.test(e.message))break}
  }
  throw last;
}
function recOnce(btn,cb,ms){
  if(btn._r){btn._r.stop();return}
  if(!OAI){say("Awaaz abhi chalu nahi. Service dene wale se rabta karein.");return}
  navigator.mediaDevices.getUserMedia({audio:true}).then(st=>{
    const ch=[],mr=new MediaRecorder(st);btn._r=mr;
    mr.ondataavailable=e=>ch.push(e.data);
    mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());btn._r=null;btn.textContent="🎤";
      try{say("Samajh raha hoon...");await cb(new Blob(ch,{type:mr.mimeType||"audio/webm"}))}catch(e){say("AI masla: "+e.message)}};
    setTimeout(()=>{if(btn._r===mr)mr.stop()},ms||30000);
    mr.start();btn.textContent="⏹";say("Bolain, phir dobara dabayein");
  }).catch(()=>say("Mic ki ijazat dein: address bar ke paas nishan > Permissions > Microphone > Allow"));
}
$("mic").onclick=()=>recOnce($("mic"),async blob=>{
  const t=await tr(blob,HINT);
  if(!t.trim()){say("Kuch suna nahi, dobara bolain");return}
  const o=await ask(SYS,t),bk=cleanBike(o.bike);
  if(bk){bike=bk;$("bike").value=bike}
  (o.work||[]).forEach(i=>work.push(it2(i)));(o.parts||[]).forEach(i=>parts.push(it3(i)));
  keep();render();say("Suna: "+t);
});
$("bikeMic").onclick=()=>recOnce($("bikeMic"),async blob=>{
  const t=await tr(blob,BIKEHINT,"en"),o=await ask(BIKESYS,t),bk=cleanBike(o.bike);
  if(bk){bike=bk;$("bike").value=bike;keep();render()}
  say("Bike: "+(bk||"samajh nahi aaya")+"  (suna: "+t+")");
},12000);

const micAdd=(id,sys,key,arr,mk)=>$(id).onclick=()=>recOnce($(id),async blob=>{
  const t=await tr(blob,HINT);
  if(!t.trim()){say("Kuch suna nahi, dobara bolain");return}
  const o=await ask(sys,t);(o[key]||[]).forEach(i=>arr().push(mk(i)));
  keep();render();say("Suna: "+t);
},20000);
micAdd("workMic",WSYS,"work",()=>work,it2);
micAdd("partMic",PSYS,"parts",()=>parts,it3);

/* ---------- bill sunana (OpenAI awaaz) ---------- */
let spk=null;
async function speakBill(b){
  if(spk){spk.pause();spk=null;say("Band");return}
  if(!OAI){say("Awaaz abhi chalu nahi. Service dene wale se rabta karein.");return}
  b=b||{bike,work,parts,total:total(),paid:$("paid").value===""?null:+$("paid").value};
  if(!b.work.length&&!b.parts.length){say("Pehle kaam ya parts daalein");return}
  try{
    say("Bill taiyar ho raha hai...");
    const data={bike:b.bike,jobs:b.work.map(x=>({name:x.n,price:x.p})),parts:b.parts.map(x=>({name:x.n,qty:x.q||1,price:x.p})),total:b.total,owed:b.paid!=null&&b.paid<b.total?b.total-b.paid:0};
    let txt;try{txt=(await ask(TTSYS,JSON.stringify(data))).say}catch(e){txt=null}
    if(!txt)txt="Bike "+data.bike+". Total "+data.total+" rupay.";
    const r=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{Authorization:"Bearer "+OAI,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini-tts",voice:"alloy",input:txt,instructions:"Speak in Urdu, slowly and clearly, like a shopkeeper reading out a bill.",response_format:"mp3"})});
    if(!r.ok)throw new Error(r.status===401?"OpenAI key ghalat hai":r.status===429?"OpenAI credit khatam":("Error "+r.status));
    const url=URL.createObjectURL(await r.blob()),au=new Audio(url);spk=au;
    au.onended=()=>{spk=null;say("Tayyar")};
    await au.play();say("Sunaya ja raha hai... (dobara dabayein to band)");
  }catch(e){spk=null;say("Awaaz nahi aayi: "+(e.message||e))}
}
$("speak").onclick=()=>speakBill();

/* ---------- printing (58mm thermal, Bluetooth) ---------- */
function drawBill(b){
  const pv=$("paid").value;
  b=b||{bike,work,parts,total:total(),cust_name:$("cName").value.trim(),paid:pv===""?null:+pv,created_at:Date.now()};
  const W=384,pad=8,lh=34,L=[],dt=new Date(b.created_at);
  L.push({t:SHOP,c:1,b:1,big:1});
  L.push({t:dt.toLocaleDateString()+" "+dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),c:1});
  L.push({t:"Bike: "+(b.bike||"-"),b:1,big:1});
  if(b.cust_name)L.push({t:"Grahak: "+b.cust_name});
  L.push({t:"--------------------------------",c:1});
  if(b.work.length){L.push({t:"KAAM",b:1});b.work.forEach(x=>L.push({t:x.n,r:String(x.p)}))}
  if(b.parts.length){L.push({t:"PARTS",b:1});b.parts.forEach(x=>L.push({t:qn(x),r:String(x.p)}))}
  L.push({t:"--------------------------------",c:1});
  L.push({t:"TOTAL",r:"Rs "+b.total,b:1,big:1});
  if(b.paid!=null&&b.paid<b.total)L.push({t:"Baqaya",r:"Rs "+(b.total-b.paid),b:1});
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
  if(!work.length&&!parts.length){say("Pehle kaam ya parts daalein");return}
  try{
    say("Printer se jud raha hai...");await printCV(drawBill());
    try{await saveBill();say("Bill print aur save ho gaya ✔")}catch(e){say("Print ho gaya, lekin save nahi hua: "+e.message)}
  }catch(e){say(e&&e.name==="NotFoundError"?"Printer chuna nahi gaya":"Print nahi hua: "+(e.message||e))}
};

/* ---------- Maalik ka hissa (PIN) ---------- */
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("shehbaz-"+s)))].map(x=>x.toString(16).padStart(2,"0")).join("");
$("pinGo").onclick=async()=>{
  const v=$("pin").value.trim(),h$=$("pinHint");
  if(v.length<4){h$.textContent="Kam se kam 4 ank likhein";return}
  const h=await sha(v);
  if(!pinHash){
    try{await db("shops?id=eq."+ME.shop_id,{method:"PATCH",headers:MIN,body:JSON.stringify({pin:h})});pinHash=h}
    catch(e){h$.textContent="PIN save nahi hua: "+e.message;return}
  }else if(h!==pinHash){h$.textContent="PIN ghalat hai";return}
  unlocked=true;$("pin").value="";h$.textContent="";openOwn();
};
$("pin").onkeydown=e=>{if(e.key==="Enter")$("pinGo").click()};
$("lockBtn").onclick=()=>{unlocked=false;$("ownBody").hidden=true;$("ownLock").hidden=false};
async function refreshOuts(){try{outs=await db("outside?select=*&order=created_at.desc&limit=30")||[]}catch(e){outs=[]}}
async function openOwn(){$("ownLock").hidden=true;$("ownBody").hidden=false;$("lim").value=LIM();await refreshOuts();ownRender()}
$("lim").onchange=e=>{ls.set("lim",+e.target.value||5);ownRender()};

async function stockAdd(name,qty,cost){
  const key=sk(name);if(key.length<2||!qty)return;
  const ex=stk.find(s=>s.name===key),n=(ex?ex.qty:0)+qty,c=Math.round(+cost)||0;
  await db("stock",{method:"POST",headers:MERGE,body:JSON.stringify({name:key,qty:n,...(c>0?{cost:c}:{})})});
  if(ex){ex.qty=n;if(c>0)ex.cost=c}else stk.push({name:key,qty:n,...(c>0?{cost:c}:{})});
  stk.sort((a,b)=>a.name<b.name?-1:1);
}
$("stAdd").onclick=async()=>{
  const v=$("stIn").value.trim();if(!v)return;const it=parseItem(v);
  try{await stockAdd(it.n,it.p||1,$("stCost").value);$("stIn").value="";$("stCost").value="";ownRender();say("Stock jama ✔")}catch(e){say("Stock nahi bana: "+e.message)}
};
$("stMic").onclick=()=>recOnce($("stMic"),async blob=>{
  const t=await tr(blob,HINT),o=await ask(STSYS,t);
  for(const i of o.items||[])await stockAdd(i.name,Math.round(+i.qty)||0,i.cost);
  ownRender();say("Stock jama: "+t);
},20000);

function ownRender(){
  if(!unlocked)return;
  const lim=LIM(),low=stk.filter(s=>s.qty<=lim);
  $("lowHint").textContent=low.length?"⚠️ Khareedna hai ("+low.length+")":"Sab stock theek hai ✔";
  const ll=$("lowList");ll.innerHTML="";
  low.forEach(s=>{const d=row2(s.name+" — "+s.qty+" bacha");d.style.background="#fde2e0";ll.append(d)});
  $("lowWa").hidden=!low.length;
  $("lowWa").onclick=()=>wa("","Khareedna hai ("+SHOP+"):\n"+low.map(s=>"- "+s.name+" ("+s.qty+" bacha)").join("\n"));
  const sv0=stk.reduce((t,s)=>t+s.qty*(s.cost||0),0);
  $("stVal").textContent="Maal ki kul qeemat (kharid ke hisaab se): Rs "+sv0+"   |   har row: bacha hua · kharid qeemat (ek ki)";
  const sl=$("stList");sl.innerHTML="";
  stk.forEach(s=>{
    const q=document.createElement("input");q.type="number";q.inputMode="numeric";q.value=s.qty;q.style.width="70px";
    const c=document.createElement("input");c.type="number";c.inputMode="numeric";c.value=s.cost||"";c.placeholder="Rs";c.style.width="78px";c.title="kharid qeemat (ek ki)";
    c.onchange=async()=>{s.cost=Math.max(0,Math.round(+c.value)||0);try{await db("stock?name=eq."+encodeURIComponent(s.name),{method:"PATCH",headers:MIN,body:JSON.stringify({cost:s.cost||null})});ownRender()}catch(e){say("Qeemat nahi badli: "+e.message)}};
    q.onchange=async()=>{s.qty=Math.max(0,+q.value||0);try{await db("stock?name=eq."+encodeURIComponent(s.name),{method:"PATCH",headers:MIN,body:JSON.stringify({qty:s.qty})});ownRender()}catch(e){say("Nahi badla: "+e.message)}};
    const x=document.createElement("button");x.className="x";x.textContent="✕";
    x.onclick=async()=>{if(!x.dataset.s){x.dataset.s=1;x.textContent="?";setTimeout(()=>{x.dataset.s="";x.textContent="✕"},3000);return}
      try{await db("stock?name=eq."+encodeURIComponent(s.name),{method:"DELETE"});stk=stk.filter(z=>z!==s);ownRender()}catch(e){say("Nahi mita: "+e.message)}};
    const d=row2(s.name,[q,c,x]);if(s.qty<=lim)d.style.background="#fde2e0";sl.append(d);
  });
  /* udhaar */
  const g={};bills.filter(b=>b.paid!=null&&b.paid<b.total).forEach(b=>{const k=b.cust_phone||b.cust_name||"Naam nahi";(g[k]=g[k]||{k,name:b.cust_name,phone:b.cust_phone,list:[],due:0});g[k].list.push(b);g[k].due+=b.total-b.paid});
  const u=$("udh");u.innerHTML="";const gs=Object.values(g);
  if(!gs.length)u.textContent="Koi udhaar nahi ✔";
  gs.forEach(c=>{
    const amt=document.createElement("input");amt.type="number";amt.inputMode="numeric";amt.placeholder="Wapsi";amt.style.width="90px";amt.style.margin="0";
    const ok=sm("✔",async()=>{
      let left=+amt.value||0;if(left<=0)return;
      try{for(const b of c.list.sort((a,z)=>new Date(a.created_at)-new Date(z.created_at))){if(left<=0)break;const take=Math.min(b.total-b.paid,left);
        await db("bills?id=eq."+b.id,{method:"PATCH",headers:MIN,body:JSON.stringify({paid:b.paid+take})});left-=take}
        await loadBills();say("Wapsi likh di ✔")}catch(e){say("Nahi likha: "+e.message)}});
    const w=sm("📲",()=>wa(c.phone,"Assalam o Alaikum "+(c.name||"")+", "+SHOP+" mein aap ka Rs "+c.due+" baqaya hai. Meherbani karke ada kar dein. Shukriya."));
    u.append(row2((c.name||"Naam nahi")+" "+(c.phone||"")+" — Rs "+c.due,[amt,ok,w]));
  });
  /* rozana */
  const dd=$("day");dd.innerHTML="";const days={};
  bills.forEach(b=>{const k=new Date(b.created_at).toDateString();(days[k]=days[k]||{n:0,t:0,m:0});days[k].n++;days[k].t+=b.total;days[k].m+=(b.paid==null?b.total:b.paid)});
  Object.keys(days).slice(0,7).forEach(k=>{const v=days[k];dd.append(row2(new Date(k).toLocaleDateString()+" · "+v.n+" bike · Rs "+v.t+" (mile "+v.m+")"))});
  /* service */
  const sv=$("svc");sv.innerHTML="";const seen={},today=new Date().toISOString().slice(0,10),soon=new Date(Date.now()+7*864e5).toISOString().slice(0,10);let any=0;
  bills.forEach(b=>{const k=norm(b.bike);if(!k||seen[k])return;seen[k]=1;
    if(b.next_service&&b.next_service<=soon){any++;
      const w=sm("📲",()=>wa(b.cust_phone,"Assalam o Alaikum "+(b.cust_name||"")+", aap ki bike "+b.bike+" ki agli service ka waqt ho gaya hai. "+SHOP));
      const d=row2(b.bike+" "+(b.cust_name||"")+" — "+b.next_service,[w]);if(b.next_service<today)d.style.background="#fde2e0";sv.append(d)}});
  if(!any)sv.textContent="Abhi koi service baqi nahi";
  /* bahar se */
  const ol=$("outl");ol.innerHTML="";
  if(!outs.length)ol.textContent="Abhi koi nahi";
  outs.forEach(o=>ol.append(row2(new Date(o.created_at).toLocaleDateString()+" · "+o.bike+" · "+o.item+(o.shop?" ("+o.shop+")":"")+" — Rs "+o.price)));
}

/* ---------- Admin: clients ---------- */
async function loadShops(){
  try{
    const r=await db("shops?select=*&order=created_at"),el=$("shopList");el.innerHTML="";
    r.forEach(s=>{
      const own=s.id===ME.shop_id;
      const b=sm(s.active?"✔":"⛔",async()=>{
        if(own){say("Apni dukaan band nahi kar sakte");return}
        try{await db("shops?id=eq."+s.id,{method:"PATCH",headers:MIN,body:JSON.stringify({active:!s.active})});say(s.active?"Band kar di":"Chalu kar di");loadShops()}catch(e){say(e.message)}
      });
      const t=sm("🔊",async()=>{
        try{await db("shops?id=eq."+s.id,{method:"PATCH",headers:MIN,body:JSON.stringify({tts:!s.tts})});
          if(own){ME.tts=!s.tts;applyFlags()}say(s.tts?"Sunayen band kar diya":"Sunayen chalu kar diya");loadShops()}catch(e){say(e.message)}
      });t.style.background=s.tts?"#2f7d32":"#a8a396";
      el.append(row2(s.name+(s.active?"":" (band)")+(own?" (aap ki)":""),[t,b]));
    });
  }catch(e){say("Clients nahi aaye: "+e.message)}
}
$("newShop").onclick=async()=>{
  const n=$("nsName").value.trim(),e=$("nsEmail").value.trim();
  if(!n||!e){say("Dukaan ka naam aur email likhein");return}
  try{await rpc("admin_new_shop",{p_name:n,p_email:e});$("nsName").value="";$("nsEmail").value="";say("Client ban gaya ✔");loadShops()}
  catch(er){say(er.message)}
};
$("setKey").onclick=async()=>{
  const k=$("keyAll").value.trim();if(k.length<10){say("Key poori paste karein");return}
  try{
    await rpc("admin_set_key",{p_key:k});
    ME=await rpc("me");OAI=(ME&&ME.openai_key)||"";keyNote();
    if(OAI===k){$("keyAll").value="";say("Key sab dukaanon mein lag gayi ✔")}
    else say("Key database mein nahi lagi, dobara try karein");
  }catch(e){say("Key nahi lagi: "+e.message);keyNote()}
};
function keyNote(){
  const t=OAI?"Awaaz chalu ✔ (key ke aakhri 4 huroof: "+OAI.slice(-4)+")":"Awaaz abhi band hai: key nahi lagi";
  $("voiceState").textContent=t;$("keyState").textContent=t;
}

/* ?login wala link: purana login hata kar login screen dikhaye */
if(/[?&]login(&|=|$)/.test(location.search)){S=null;ls.del("sess");try{history.replaceState(null,"",location.pathname)}catch(e){}}
show();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
