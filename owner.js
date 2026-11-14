"use strict";
/* ===== Maalik ka hissa (PIN): live hisaab, stock, udhaar, hisaab ki file, Excel ===== */
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
$("lockBtn").onclick=()=>{unlocked=false;$("invBox").hidden=true;$("lowList").hidden=true;$("ownBody").hidden=true;$("ownLock").hidden=false;render()};
async function refreshOuts(){try{outs=await db("outside?select=*&order=created_at.desc&limit=60")||[]}catch(e){outs=[]}}
async function openOwn(){$("ownLock").hidden=true;$("ownBody").hidden=false;$("lim").value=LIM();$("xlMonth").value=dk(new Date()).slice(0,7);await refreshOuts();ownRender(true);render()}
$("lim").onchange=e=>{ls.set("lim",+e.target.value||5);ownRender(true)};

/* ---------- hisaab ke figures ---------- */
const blank=()=>({n:0,m:0,po:0,pq:0,dc:0,net:0,mile:0,newU:0,wapsi:0,owe:[]});
function addTo(a,b){["n","m","po","pq","dc","net","mile","newU","wapsi"].forEach(k=>a[k]+=b[k])}
function dayStats(){
  const D={},get=k=>D[k]||(D[k]=blank());
  bills.forEach(b=>{
    if(b.pending)return;
    const d=get(dk(new Date(b.created_at)));
    const m=sumP(b.work),po=sumP(b.parts.filter(x=>!x.o)),pq=sumP(b.parts.filter(x=>x.o)),dc=b.discount||0,nv=b.total-dc,pv=b.prev_due||0,paid=b.paid==null?nv+pv:b.paid;
    d.n++;d.m+=m;d.po+=po;d.pq+=pq;d.dc+=dc;d.net+=nv;d.mile+=paid;
    const nu=Math.max(0,nv-Math.max(0,paid-pv));d.newU+=nu;
    if(nu>0)d.owe.push({n:b.cust_name||b.bike||"?",a:nu});
  });
  pays.forEach(p=>{const d=get(dk(new Date(p.created_at)));d.mile+=p.amount;d.wapsi+=p.amount});
  return D;
}
const kv=(a,v,bold)=>{const r=document.createElement("div");r.className="kv";const s=document.createElement("span"),b=document.createElement("b");s.textContent=a;b.textContent=v;if(bold)r.style.fontWeight="700";r.append(s,b);return r};
const figs=t=>"Kaam "+t.net+" · Mile "+t.mile+" · Udhaar "+t.newU+(t.wapsi?" · Wapsi "+t.wapsi:"");

let lastSig="",DS={};
function ownRender(force){
  if(!unlocked)return;
  const sig=bills.length+":"+pays.length+":"+outs.length+":"+stk.length+":"+dk(new Date())+":"+bills.reduce((t,b)=>t+(b.total||0)+(b.discount||0)+(b.paid||0)+(b.moved_to?1:0),0)+":"+stk.reduce((t,s)=>t+s.qty+(s.lim||0)+(s.cost||0),0);
  if(!force&&sig===lastSig)return;
  lastSig=sig;DS=dayStats();
  liveRender();stockRender();udhRender();treeRender();svcRender();outRender();
}
function liveRender(){
  const t=DS[dk(new Date())]||blank(),el=$("live");el.innerHTML="";
  el.append(kv("Bikes aaj",t.n),kv("🔧 Mazdoori","Rs "+t.m),kv("⚙️ Parts","Rs "+t.po),kv("🌐 Bahar ka saman","Rs "+t.pq),kv("Discount","-Rs "+t.dc),kv("Aaj ka kul kaam","Rs "+t.net,1),kv("💰 Jeb mein aaye","Rs "+t.mile,1),kv("Naya udhaar","Rs "+t.newU),kv("Purane udhaar ki wapsi","Rs "+t.wapsi));
}

/* ---------- stock ---------- */
const lowOf=s=>s.qty<=(s.lim!=null?s.lim:LIM());
const stName=s=>cap(s.name)+(s.brand?" ("+cap(s.brand)+")":"");
async function stockAdd(name,brand,qty,cost){
  const key=sk(name),br=sk(brand);if(key.length<2||!qty)return;
  const ex=stk.find(s=>s.name===key&&(s.brand||"")===br),n=(ex?ex.qty:0)+qty,c=Math.round(+cost)||0;
  await db("stock",{method:"POST",headers:MERGE,body:JSON.stringify({name:key,brand:br,qty:n,...(c>0?{cost:c}:{})})});
  if(ex){ex.qty=n;if(c>0)ex.cost=c}else stk.push({name:key,brand:br,qty:n,...(c>0?{cost:c}:{})});
  stk.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:(a.brand||"")<(b.brand||"")?-1:1);
  await logStock([{name:key,brand:br,delta:qty,why:"add"}]);
}
$("stAdd").onclick=async()=>{
  const v=$("stIn").value.trim();if(!v)return;
  const q=Math.round(+$("stQty").value)||0,it=q>0?{n:v,p:q}:parseItem(v);
  try{await stockAdd(it.n,$("stBrand").value,it.p||1,$("stCost").value);$("stIn").value="";$("stQty").value="";$("stBrand").value="";$("stCost").value="";ownRender(true);say("Stock jama ✔")}
  catch(e){say("Stock nahi bana: "+e.message)}
};
$("stQty").onkeydown=e=>{if(e.key==="Enter")$("stAdd").click()};
$("stMic").onclick=()=>recOnce($("stMic"),async blob=>{
  const t=await tr(blob,HINT),o=await ask(STSYS,t);
  for(const i of o.items||[])await stockAdd(i.name,i.brand||"",Math.round(+i.qty)||0,i.cost);
  ownRender(true);say("Stock jama: "+t);
},20000);
const patchStock=(s,body)=>db("stock?name=eq."+enc(s.name)+"&brand=eq."+enc(s.brand||""),{method:"PATCH",headers:MIN,body:JSON.stringify(body)});
function lowItems(){return stk.filter(lowOf)}
const invShow=on=>{$("invBox").hidden=!on;if(on)$("invBox").scrollIntoView({behavior:"smooth",block:"start"})};
$("invBtn").onclick=()=>invShow($("invBox").hidden);
$("invClose").onclick=()=>{invShow(false);$("invBtn").scrollIntoView({block:"center"})};
$("lowTog").onclick=()=>{const ll=$("lowList");ll.hidden=!ll.hidden;$("lowTog").textContent=ll.hidden?"▼ List dikhayein ("+ll.children.length+")":"▲ List band karein"};
function stockRender(){
  const low=lowItems(),canSay=ME&&ME.tts&&voiceOK();
  $("lowHint").textContent=low.length?"⚠️ Khareedna hai ("+low.length+")":"Sab stock theek hai ✔";
  $("invBtn").textContent="📦 Inventory (Stock)"+(low.length?" · ⚠️ "+low.length+" kam":"");
  const ll=$("lowList");ll.innerHTML="";
  low.forEach((s,i)=>{const d=row2((i+1)+". "+stName(s)+" — "+s.qty+" bacha");d.style.background="#fde2e0";ll.append(d)});
  $("lowTog").hidden=!low.length;if(!low.length)ll.hidden=true;
  $("lowTog").textContent=ll.hidden?"▼ List dikhayein ("+low.length+")":"▲ List band karein";
  $("lowWa").hidden=!low.length;$("lowSay").hidden=!(low.length&&canSay);
  $("lowWa").onclick=()=>wa(ME.wa_number||"","Khareedna hai ("+SHOP+"):\n"+low.map((s,i)=>(i+1)+". "+stName(s)+" ("+s.qty+" bacha)").join("\n"));
  $("lowSay").onclick=()=>{const names=low.map(s=>s.name+(s.brand?" "+s.brand:""));speakSentence(LOWSYS,{items:names},"Khareedna hai: "+names.join(", "))};
  const tot=stk.reduce((t,s)=>t+s.qty*(s.cost||0),0);
  $("stVal").textContent="Maal ki kul qeemat (kharid ke hisaab se): Rs "+tot;
  const sl=$("stList");sl.innerHTML="";
  const cnt={};stk.forEach(s=>cnt[s.name]=(cnt[s.name]||0)+1);
  let lastName="";
  stk.forEach(s=>{
    if(s.name!==lastName&&cnt[s.name]>1){
      const sum=stk.filter(z=>z.name===s.name).reduce((t,z)=>t+z.qty,0);
      const h=document.createElement("div");h.className="fold";h.textContent="📦 "+cap(s.name)+": kul "+sum;sl.append(h)}
    lastName=s.name;
    const card=document.createElement("div");card.className="stk"+(lowOf(s)?" low":"");
    const t=document.createElement("div");t.className="t";
    const nm=document.createElement("span");nm.textContent=stName(s);t.append(nm);
    if(canSay){const sp=sm("🔊",()=>speakSentence(LOWSYS,{items:[s.name+(s.brand?" "+s.brand:"")]},s.name));sp.style.background="#1d5fb4";t.append(sp)}
    const x=document.createElement("button");x.className="x";x.textContent="✕";
    x.onclick=async()=>{if(!x.dataset.s){x.dataset.s=1;x.textContent="?";setTimeout(()=>{x.dataset.s="";x.textContent="✕"},3000);return}
      try{await db("stock?name=eq."+enc(s.name)+"&brand=eq."+enc(s.brand||""),{method:"DELETE"});await logStock([{name:s.name,brand:s.brand||"",delta:-s.qty,why:"delete"}]);stk=stk.filter(z=>z!==s);ownRender(true)}catch(e){say("Nahi mita: "+e.message)}};
    t.append(x);
    const f=document.createElement("div");f.className="f";
    const mk=(label,val,ph,fn)=>{const w=document.createElement("div");w.textContent=label;const i=document.createElement("input");i.type="number";i.inputMode="numeric";i.value=val==null?"":val;i.placeholder=ph||"";i.onchange=()=>fn(i);w.append(i);f.append(w)};
    mk("Bacha",s.qty,"",async i=>{const nq=Math.max(0,Math.round(+i.value)||0),d=nq-s.qty;s.qty=nq;try{await patchStock(s,{qty:nq});if(d)await logStock([{name:s.name,brand:s.brand||"",delta:d,why:"adjust"}]);ownRender(true)}catch(e){say("Nahi badla: "+e.message)}});
    mk("Hadd (itne ya kam par laal)",s.lim,String(LIM()),async i=>{const v=i.value===""?null:Math.max(0,Math.round(+i.value)||0);s.lim=v;try{await patchStock(s,{lim:v});ownRender(true)}catch(e){say("Hadd nahi badli: "+e.message)}});
    mk("Kharid Rs (ek ki)",s.cost,"Rs",async i=>{const v=i.value===""?null:Math.max(0,Math.round(+i.value)||0);s.cost=v;try{await patchStock(s,{cost:v});ownRender(true)}catch(e){say("Qeemat nahi badli: "+e.message)}});
    card.append(t,f);sl.append(card);
  });
}

/* ---------- udhaar ---------- */
function udhRender(){
  const g={};
  bills.filter(b=>due(b)>0).forEach(b=>{const k=b.cust_phone||b.cust_name||b.bike||"?";(g[k]=g[k]||{name:b.cust_name||b.bike||"Naam nahi",phone:b.cust_phone,list:[],due:0});g[k].list.push(b);g[k].due+=due(b)});
  const u=$("udh");u.innerHTML="";const gs=Object.values(g),all=gs.reduce((t,c)=>t+c.due,0);
  const t=DS[dk(new Date())]||blank();
  $("udhToday").textContent="Aaj ka naya udhaar: Rs "+t.newU+"   |   Kul baqaya abhi: Rs "+all;
  if(!gs.length)u.textContent="Koi udhaar nahi ✔";
  gs.forEach(c=>{
    const amt=document.createElement("input");amt.type="number";amt.inputMode="numeric";amt.placeholder="Wapsi";amt.style.width="90px";amt.style.margin="0";
    const ok=sm("✔",async()=>{
      let left=+amt.value||0;if(left<=0)return;const rows=[];
      for(const b of c.list.slice().sort((a,z)=>new Date(a.created_at)-new Date(z.created_at))){if(left<=0)break;const take=Math.min(due(b),left);if(take>0){rows.push({bill_id:b.id,amount:take});left-=take}}
      try{await db("payments",{method:"POST",headers:MIN,body:JSON.stringify(rows)});await loadBills();say("Wapsi likh di ✔")}catch(e){say("Nahi likha: "+e.message)}});
    const w=sm("📲",()=>wa(c.phone,"Assalam o Alaikum "+(c.name||"")+", "+SHOP+" mein aap ka Rs "+c.due+" baqaya hai. Meherbani karke ada kar dein. Shukriya."));
    u.append(row2(c.name+" "+(c.phone||"")+" — Rs "+c.due,[amt,ok,w]));
  });
}

/* ---------- hisaab ki file: Annual > Half-Yearly > Quarterly > Monthly > Daily ---------- */
const treeOpen=new Set();
const WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function treeRender(){
  const root={s:blank(),k:{}};
  Object.keys(DS).forEach(day=>{
    const [y,mo]=day.split("-").map(Number),path=[String(y),"H"+(mo<=6?1:2),"Q"+Math.ceil(mo/3),y+"-"+p2(mo),day];
    let node=root;addTo(root.s,DS[day]);
    path.forEach((seg,i)=>{node=node.k[seg]||(node.k[seg]={s:blank(),k:{},d:i===4?DS[day]:null});addTo(node.s,DS[day])});
  });
  const el=$("tree");el.innerHTML="";
  const now=new Date(),cy=String(now.getFullYear()),cm=cy+"-"+p2(now.getMonth()+1);
  if(!treeOpen.size){treeOpen.add("y"+cy);treeOpen.add("y"+cy+"/H"+(now.getMonth()<6?1:2));treeOpen.add("y"+cy+"/H"+(now.getMonth()<6?1:2)+"/Q"+Math.ceil((now.getMonth()+1)/3));treeOpen.add("y"+cy+"/H"+(now.getMonth()<6?1:2)+"/Q"+Math.ceil((now.getMonth()+1)/3)+"/"+cm)}
  const LBL=(depth,seg)=>{
    if(depth===0)return "Annual "+seg;
    if(depth===1)return "Half-Yearly "+seg+(seg==="H1"?" (Jan - Jun)":" (Jul - Dec)");
    if(depth===2){const q=+seg[1];return "Quarterly "+seg+" ("+MON[(q-1)*3]+" - "+MON[q*3-1]+")"}
    if(depth===3){const [y,m]=seg.split("-").map(Number);return "Monthly "+MON[m-1]+" "+y}
    const d=new Date(seg+"T12:00:00");return p2(d.getDate())+" "+MON[d.getMonth()]+", "+WD[d.getDay()];
  };
  const mk=(node,depth,seg,key)=>{
    const det=document.createElement("details"),s=document.createElement("summary");
    s.textContent=LBL(depth,seg)+" · "+node.s.n+" bike";det.append(s);
    const fl=document.createElement("div");fl.className="sm";fl.textContent=figs(node.s);det.append(fl);
    let built=false;
    const build=()=>{
      if(built)return;built=true;
      if(depth===4){
        const t=node.d,b=document.createElement("div");
        b.append(kv("🔧 Mazdoori","Rs "+t.m),kv("⚙️ Parts","Rs "+t.po),kv("🌐 Bahar ka saman","Rs "+t.pq),kv("Discount","-Rs "+t.dc));
        if(t.owe.length){const h=document.createElement("div");h.className="hint";h.textContent="Udhaar: "+t.owe.map(o=>o.n+" "+o.a).join(", ");b.append(h)}
        det.append(b);return;
      }
      Object.keys(node.k).sort().reverse().forEach(k=>det.append(mk(node.k[k],depth+1,k,key+"/"+k)));
    };
    det.ontoggle=()=>{if(det.open){treeOpen.add(key);build()}else treeOpen.delete(key)};
    if(treeOpen.has(key)){det.open=true;build()}
    return det;
  };
  Object.keys(root.k).sort().reverse().forEach(y=>el.append(mk(root.k[y],0,y,"y"+y)));
  if(!Object.keys(root.k).length)el.textContent="Abhi koi bill nahi";
}

/* ---------- service ki yaad, bahar se liya hua ---------- */
function svcRender(){
  const sv=$("svc");sv.innerHTML="";const seen={},today=dk(new Date()),soon=addD(7);let any=0;
  bills.forEach(b=>{const k=norm(b.bike);if(!k||seen[k]||b.pending)return;seen[k]=1;
    if(b.next_service&&b.next_service<=soon){any++;
      const w=sm("📲",()=>wa(b.cust_phone,"Assalam o Alaikum "+(b.cust_name||"")+", aap ki bike "+b.bike+" ki agli service ka waqt ho gaya hai. "+SHOP));
      const d=row2(b.bike+" "+(b.cust_name||"")+" — "+b.next_service,[w]);if(b.next_service<today)d.style.background="#fde2e0";sv.append(d)}});
  if(!any)sv.textContent="Abhi koi service baqi nahi";
}
function outRender(){
  const ol=$("outl");ol.innerHTML="";
  if(!outs.length)ol.textContent="Abhi koi nahi";
  outs.forEach(o=>ol.append(row2(fmtD(new Date(o.created_at))+" · "+o.bike+" · "+o.item+(o.shop?" ("+o.shop+")":"")+" — Rs "+o.price)));
}

/* ---------- mahine ki Excel ---------- */
function loadXLSX(){
  return new Promise((res,rej)=>{
    if(window.XLSX)return res(window.XLSX);
    const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>res(window.XLSX);s.onerror=()=>rej(new Error("Excel ka hissa load nahi hua. Internet check karein"));
    document.head.append(s);
  });
}
function csvDown(rows,name){
  const t=rows.map(r=>r.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+t],{type:"text/csv"}));a.download=name+".csv";document.body.append(a);a.click();a.remove();
}
$("xlGo").onclick=async()=>{
  const mv=$("xlMonth").value;if(!mv){say("Mahina chunein");return}
  const [y,m]=mv.split("-").map(Number),start=new Date(y,m-1,1),end=new Date(y,m,1);
  try{
    say("Excel ban rahi hai...");
    const inM=d=>{const t=new Date(d);return t>=start&&t<end};
    const B=bills.filter(b=>!b.pending&&inM(b.created_at)).sort((a,z)=>new Date(a.created_at)-new Date(z.created_at));
    const P=pays.filter(p=>inM(p.created_at));
    const O=await db("outside?select=*&created_at=gte."+enc(start.toISOString())+"&created_at=lt."+enc(end.toISOString())+"&order=created_at.asc&limit=5000")||[];
    let logs=[];try{logs=await db("stock_log?select=*&created_at=gte."+enc(start.toISOString())+"&order=created_at.asc&limit=20000")||[]}catch(e){}
    const days={};B.forEach(b=>{});
    const D={},get=k=>D[k]||(D[k]=blank());
    B.forEach(b=>{const d=get(dk(new Date(b.created_at))),m2=sumP(b.work),po=sumP(b.parts.filter(x=>!x.o)),pq=sumP(b.parts.filter(x=>x.o)),dc=b.discount||0,nv=b.total-dc,pv=b.prev_due||0,paid=b.paid==null?nv+pv:b.paid;
      d.n++;d.m+=m2;d.po+=po;d.pq+=pq;d.dc+=dc;d.net+=nv;d.mile+=paid;d.newU+=Math.max(0,nv-Math.max(0,paid-pv))});
    P.forEach(p=>{const d=get(dk(new Date(p.created_at)));d.mile+=p.amount;d.wapsi+=p.amount});
    const T=blank();Object.values(D).forEach(d=>addTo(T,d));
    const owedNow=bills.filter(b=>due(b)>0).reduce((t,b)=>t+due(b),0);
    const sum=[["Mahina",MON[m-1]+" "+y],["Dukaan",ME.name],[],["Bills (bikes)",T.n],["Mazdoori",T.m],["Parts (apne stock ke)",T.po],["Bahar ka saman",T.pq],["Discount",T.dc],["Kul kaam",T.net],["Jeb mein aaye (mile)",T.mile],["Naya udhaar",T.newU],["Purane udhaar ki wapsi",T.wapsi],["Kul baqaya abhi tak",owedNow]];
    const dayRows=[["Tareekh","Bikes","Mazdoori","Parts","Bahar ka saman","Discount","Kul kaam","Mile","Naya udhaar","Wapsi"]];
    Object.keys(D).sort().forEach(k=>{const d=D[k];dayRows.push([k,d.n,d.m,d.po,d.pq,d.dc,d.net,d.mile,d.newU,d.wapsi])});
    const billRows=[["Tareekh","Bike","Customer","Phone","Mazdoori","Parts","Bahar ka saman","Discount","Purana baqaya","Mile","Baqaya abhi"]];
    B.forEach(b=>billRows.push([dk(new Date(b.created_at))+" "+fmtT(new Date(b.created_at)),b.bike,b.cust_name||"",b.cust_phone||"",sumP(b.work),sumP(b.parts.filter(x=>!x.o)),sumP(b.parts.filter(x=>x.o)),b.discount||0,b.prev_due||0,b.paid==null?"":b.paid,due(b)]));
    const udhRows=[["Customer","Phone","Bike","Baqaya abhi"]];
    bills.filter(b=>due(b)>0).forEach(b=>udhRows.push([b.cust_name||"",b.cust_phone||"",b.bike,due(b)]));
    const outRows=[["Tareekh","Bike","Cheez","Dukaan","Qeemat"]];
    O.forEach(o=>outRows.push([dk(new Date(o.created_at)),o.bike,o.item,o.shop||"",o.price]));
    const key=s=>s.name+"|"+(s.brand||""),M={};
    const after={},rec={},sold={},oth={};
    logs.forEach(l=>{const k=l.name+"|"+(l.brand||""),t=new Date(l.created_at);
      if(t>=end)after[k]=(after[k]||0)+l.delta;
      else if(l.why==="add")rec[k]=(rec[k]||0)+l.delta;
      else if(l.why==="sale")sold[k]=(sold[k]||0)-l.delta;
      else oth[k]=(oth[k]||0)+l.delta});
    const stRows=[["Item","Company","Shuru mein","Aaya","Bika","Dusri tabdeeli","Ant mein","Abhi hai","Kharid qeemat (ek ki)","Ant ke maal ki qeemat"]];
    stk.forEach(s=>{const k=key(s),close=s.qty-(after[k]||0),op=close-(rec[k]||0)+(sold[k]||0)-(oth[k]||0);
      stRows.push([s.name,s.brand||"",op,rec[k]||0,sold[k]||0,oth[k]||0,close,s.qty,s.cost||"",s.cost?close*s.cost:""])});
    stRows.push([],["Nota: stock ki tabdeeli ka record us din se shuru hua jab app mein yeh hissa laga. Us se pehle ke mahine mein Aaya/Bika nahi dikhega."]);
    const fname=ME.name.replace(/[^\w]+/g,"_")+"_"+y+"-"+p2(m);
    try{
      const X=await loadXLSX(),wb=X.utils.book_new();
      [["Khulasa",sum],["Roz ka hisaab",dayRows],["Bills",billRows],["Udhaar",udhRows],["Bahar ka saman",outRows],["Stock",stRows]].forEach(([n,r])=>X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(r),n));
      X.writeFile(wb,fname+".xlsx");say("Excel tayyar ✔ (Downloads mein dekhein)");
    }catch(e){csvDown(sum.concat([[],["ROZ KA HISAAB"]],dayRows,[[],["BILLS"]],billRows,[[],["UDHAAR"]],udhRows,[[],["BAHAR KA SAMAN"]],outRows,[[],["STOCK"]],stRows),fname);say("Excel (CSV) tayyar ✔. Excel mein khul jayegi")}
  }catch(e){say("Excel nahi bani: "+e.message)}
};
