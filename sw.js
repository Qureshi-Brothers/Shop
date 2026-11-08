// Sirf network se leta hai, taake naya version hamesha foran mile.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{e.respondWith(fetch(e.request))});
