const CACHE = "vasi-app-v124";
const MAP_CACHE = "vasi-map-runtime-v2";
const APP_BASE = self.registration.scope;
const appUrl = (path) => new URL(path, APP_BASE).href;
const CORE = [
  appUrl("vasi-document-upload.js"), appUrl("driver-status.html"), appUrl("vasi-provider-access.js"),
  appUrl("assets/ride-fare-guard.js"),
  appUrl("app.html"),appUrl("index.html"),appUrl("ride-flow.html"),appUrl("vasi-network.js"),appUrl("vendor/leaflet-1.9.4.js"),appUrl("vendor/leaflet-1.9.4.css"),appUrl("assets/vasi-logo.png"),appUrl("driver-home.html"),appUrl("driver-preview.html"),appUrl("ride-live-demo.html"),appUrl("driver.html"),appUrl("delivery-driver.html"),appUrl("vasi-driver-shell.css"),appUrl("vasi-driver-dashboard.css"),appUrl("vasi-partner-mobile.css"),appUrl("vasi-driver-dashboard.js"),appUrl("partner.html"),appUrl("restaurant-register.html"),appUrl("restaurant-register-form.html"),appUrl("assets/ride-service.webp"),appUrl("assets/eats-service.webp"),appUrl("assets/delivery-service.webp"),appUrl("assets/vehicles/go.webp"),appUrl("assets/vasi-logo.png"),appUrl("assets/vasi-mark.png"),appUrl("manifest.webmanifest"),appUrl("driver-manifest.webmanifest"),appUrl("partner-manifest.webmanifest"),appUrl("admin-manifest.webmanifest"),appUrl("admin-login.html"),appUrl("admin-install.js"),appUrl("vasi-pwa.js"),appUrl("vasi-mobile-fit.css"),appUrl("vasi-word-icon-192.png"),appUrl("vasi-word-icon-512.png"),appUrl("vasi-notifications.js"),appUrl("vasi-languages.js"),appUrl("vasi-navigation.js"),appUrl("vasi-region.js"),appUrl("vasi-airports.js"),appUrl("vasi-call.js"),appUrl("vasi-account-role.js"),appUrl("delete-account.html"),appUrl("business-account.html"),appUrl("group-order.html"),appUrl("food-checkout.html"),appUrl("safety.html"),appUrl("share-ride.html"),appUrl("support.html"),appUrl("food-orders.html"),appUrl("restaurant-dashboard.html"),appUrl("restaurant-orders.html")
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(url=>new Request(url, { cache: "reload" })))).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  const mapHost=/((^|\.)tile\.openstreetmap\.org$)|((^|\.)tiles\.openfreemap\.org$)/.test(url.hostname);
  const assetHost=["unpkg.com","cdn.jsdelivr.net"].includes(url.hostname);
  if (url.origin !== self.location.origin) {
    if(!(mapHost||assetHost))return;
    e.respondWith(caches.open(MAP_CACHE).then(async cache=>{
      const cached=await cache.match(e.request);
      const network=fetch(e.request).then(response=>{
        if(response.ok||response.type==="opaque")cache.put(e.request,response.clone());
        return response;
      }).catch(()=>cached);
      return cached||network;
    }));
    return;
  }
  if(url.pathname.startsWith("/api/"))return;
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(n=>{
      const copy=n.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return n
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match(
      url.pathname.startsWith("/admin")?appUrl("admin-login.html"):
      url.pathname==="/driver"||url.pathname==="/driver/"||url.pathname.endsWith("/driver.html")||url.pathname.endsWith("/delivery-driver.html")?appUrl("driver-home.html"):
      url.pathname==="/partner"||url.pathname==="/partner/"||url.pathname.startsWith("/restaurant-")?appUrl("partner.html"):
      url.pathname==="/ride"||url.pathname.endsWith("/ride-flow.html")?appUrl("ride-flow.html"):
      url.pathname==="/"||url.pathname.endsWith("/index.html")?appUrl("index.html"):appUrl("app.html")
    ))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{
    const copy=n.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return n
  })));
});
self.addEventListener("push",event=>{let data={};try{data=event.data?.json()||{}}catch(_){data={body:event.data?.text()||"Vous avez une nouvelle mise à jour VASI."}}event.waitUntil(self.registration.showNotification(data.title||"VASI",{body:data.body||"Vous avez une nouvelle mise à jour.",icon:appUrl("vasi-word-icon-192.png"),badge:appUrl("vasi-word-icon-192.png"),tag:data.tag||"vasi-update",renotify:false,silent:Boolean(data.silent),vibrate:data.silent?[]:[180,80,180],data:{url:appUrl(data.url||"activity.html")}}))});
self.addEventListener("notificationclick",event=>{event.notification.close();const target=new URL(event.notification.data?.url||appUrl("activity.html"),APP_BASE).href;event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{const openClient=clients.find(client=>client.url.startsWith(self.location.origin));if(openClient){openClient.navigate(target);return openClient.focus()}return self.clients.openWindow(target)}))});
