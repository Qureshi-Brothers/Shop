"use strict";
/* ===== Admin: clients, switch, figures, OpenAI key ===== */
const SHOPCOLS="id,name,active,tts,voice,phone,address,wa_number,created_at";
const openShops=new Set();
function adminStart(){loadShops();keyNote()}
async function loadShops(){
  try{
    const r=await db("shops?select="+SHOPCOLS+"&order=created_at");
    let st=[];try{st=await rpc("admin_stats")||[]}catch(e){}
    const stm={};st.forEach(x=>stm[x.sid]=x);
    const el=$("shopList");el.innerHTML="";
    r.forEach(s=>{
      const own=s.id===ME.shop_id,x=stm[s.id]||{};
      const det=document.createElement("details"),sum=document.createElement("summary");
      det.open=openShops.has(s.id);det.ontoggle=()=>{if(det.open)openShops.add(s.id);else openShops.delete(s.id)};
      sum.textContent=s.name+(s.active?"":" (band)")+(own?" (aap ki)":"")+" · aaj "+(x.bills_today||0)+" bike";det.append(sum);
      const info=document.createElement("div");
      info.append(kv("Aaj ke bills",x.bills_today||0),kv("Aaj ka kaam","Rs "+(x.kaam_today||0)),kv("Is mahine ke bills",x.bills_month||0),kv("Is mahine ka kaam","Rs "+(x.kaam_month||0)),kv("Is mahine mile","Rs "+(x.mile_month||0)),kv("Kul baqaya abhi","Rs "+(x.udhaar_now||0)),kv("Aakhri bill",x.last_bill?fmtD(new Date(x.last_bill))+" "+fmtT(new Date(x.last_bill)):"Abhi tak koi nahi"));
      det.append(info);
      const mkTog=(label,on,fn)=>{const b=btn(label+": "+(on?"ON":"OFF"),fn);b.style.background=on?"#2f7d32":"#a8a396";b.style.flex="none";b.style.width="100%";return b};
      const patch=async body=>{try{await db("shops?id=eq."+s.id,{method:"PATCH",headers:MIN,body:JSON.stringify(body)});
        if(own){Object.assign(ME,body);applyFlags()}say("Badal diya ✔");loadShops()}catch(e){say(e.message)}};
      det.append(
        mkTog("🎙️ Awaaz (OpenAI)",s.voice!==false,()=>patch({voice:s.voice===false})),
        mkTog("🔊 Sunana (bill aur stock)",!!s.tts,()=>patch({tts:!s.tts})),
        mkTog("Dukaan chalu",!!s.active,()=>{if(own){say("Apni dukaan band nahi kar sakte");return}patch({active:!s.active})}));
      const mkIn=(ph,val)=>{const i=document.createElement("input");i.placeholder=ph;i.value=val||"";return i};
      const ph=mkIn("Dukaan ka phone (bill par)",s.phone),ad=mkIn("Dukaan ka pata (bill par)",s.address),wn=mkIn("Client ka WhatsApp number (khareedna hai list ke liye)",s.wa_number);
      const sv=btn("💾 Number/pata save",()=>patch({phone:ph.value.trim(),address:ad.value.trim(),wa_number:wn.value.trim()}));
      sv.style.width="100%";sv.className="big g";sv.style.fontSize="19px";
      det.append(ph,ad,wn,sv);
      el.append(det);
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
    ME=await rpc("me");OAI=(ME&&ME.openai_key)||"";keyNote();applyFlags();
    if(ME&&(ME.has_key||OAI===k)){$("keyAll").value="";say("Key sab dukaanon mein lag gayi ✔")}
    else say("Key database mein nahi lagi, dobara try karein");
  }catch(e){say("Key nahi lagi: "+e.message);keyNote()}
};
function keyNote(){
  const t=ME&&(ME.openai_key||ME.has_key)?"Key lagi hui hai ✔"+(ME.openai_key?" (aakhri 4 huroof: "+ME.openai_key.slice(-4)+")":""):"Abhi key nahi lagi";
  $("keyState").textContent=t;
}
boot();
