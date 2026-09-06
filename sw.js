const CACHE = "vasi-app-v30";
const APP_BASE = self.registration.scope;
const appUrl = (path) => new URL(path, APP_BASE).href;
const CORE = [
  appUrl("app.html"),
  appUrl("index.html"),
  appUrl("assets/ride-service.webp"),
  appUrl("assets/eats-service.webp"),
  appUrl("assets/delivery-service.webp"),
  appUrl("manifest.webmanifest"),
  appUrl("vasi-mobile-fit.css"),
  appUrl("vasi-icon.svg"),
  appUrl("vasi-icon-192.png"),
  appUrl("vasi-icon-512.png"),
  appUrl("vasi-notifications.js"),
  appUrl("vasi-languages.js"),
  appUrl("vasi-call.js"),
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((n) => {
          const copy = n.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return n;
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match(url.pathname === "/" || url.pathname.endsWith("/index.html") ? appUrl("index.html") : appUrl("app.html"))),
        ),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (r) =>
        r ||
        fetch(e.request).then((n) => {
          const copy = n.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return n;
        }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (_) {
    data = { body: event.data?.text() || "You have a new VASI update." };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VASI", {
      body: data.body || "You have a new update.",
      icon: appUrl("vasi-icon.svg"),
      badge: appUrl("vasi-icon.svg"),
      tag: data.tag || "vasi-update",
      renotify: false,
      silent: Boolean(data.silent),
      vibrate: data.silent ? [] : [180, 80, 180],
      data: { url: appUrl(data.url || "activity.html") },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || appUrl("activity.html"),
    APP_BASE,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const openClient = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (openClient) {
          openClient.navigate(target);
          return openClient.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
