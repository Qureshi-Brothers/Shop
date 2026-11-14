// Pehle internet se leta hai (naya version foran milta hai). Internet na ho to purani copy se chalta hai.
const CACHE="bill-v15";
const SHELL=["./","index.html","app.js","owner.js","admin.js","manifest.json","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin||u.pathname.endsWith("version.json"))return;
  e.respondWith(
    fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==="navigate"?caches.match("index.html"):undefined)))
  );
});
