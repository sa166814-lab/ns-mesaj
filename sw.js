/* NS-Mesaj service worker — PWA kurulumu + (ileride) push için temel */
const CACHE="ns-mesaj-v1";
self.addEventListener("install",e=>{ self.skipWaiting(); });
self.addEventListener("activate",e=>{ e.waitUntil(self.clients.claim()); });

/* basit offline: ağ başarısızsa cache'ten dene */
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); return r;
    }).catch(()=>caches.match(e.request))
  );
});

/* arka plan PUSH burada işlenecek (FCM/web-push kurulunca aktifleşir) */
self.addEventListener("push",e=>{
  let d={title:"NS-Mesaj",body:"Yeni mesaj"};
  try{ d=e.data.json(); }catch(_){}
  e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:"./icon-192.png"}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window"}).then(cs=>cs.length?cs[0].focus():clients.openWindow("./")));
});
