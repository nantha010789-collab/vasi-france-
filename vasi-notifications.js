(function () {
  "use strict";

  const CHANNEL_PREFIX = "vasi-live-alerts";
  const HISTORY_KEY = "vasi_notification_history_v1";
  const PREFS_KEY = "vasi_notification_preferences_v1";
  const HISTORY_LIMIT = 50;
  const APP_BASE = new URL(".", document.currentScript?.src || location.href);
  const appUrl = (path) =>
    new URL(String(path || "").replace(/^\//, ""), APP_BASE).href;
  let activeClient = null;
  let activeChannel = null;
  let activeRole = "customer";
  let registrationPromise = null;
  let urgentTimer = null;

  const statusCopy = {
    ride: {
      requested: ["Ride requested", "VASI is finding a nearby driver."],
      accepted: ["Driver accepted", "Your VASI driver is on the way."],
      driver_arriving: ["Driver has arrived", "Your driver is waiting at the pickup point."],
      in_progress: ["Ride started", "Your VASI trip is now in progress."],
      completed: ["Ride completed", "Your trip is complete. Your receipt is ready."],
      cancelled: ["Ride cancelled", "This VASI ride has been cancelled."],
      canceled: ["Ride cancelled", "This VASI ride has been cancelled."],
    },
    eats: {
      pending: ["Order placed", "Your VASI Eats order was sent to the restaurant."],
      accepted: ["Restaurant accepted", "The restaurant accepted your order."],
      preparing: ["Food is being prepared", "Your VASI Eats order is in the kitchen."],
      ready_for_pickup: ["Order ready", "Your food is ready for courier pickup."],
      picked_up: ["Courier picked up", "Your food is on the way."],
      on_the_way: ["Courier on the way", "Your food will arrive soon."],
      delivered: ["Order delivered", "Your VASI Eats order has arrived."],
      cancelled: ["Order cancelled", "Your VASI Eats order was cancelled."],
      canceled: ["Order cancelled", "Your VASI Eats order was cancelled."],
    },
    delivery: {
      pending: ["Delivery requested", "VASI is finding a courier."],
      accepted: ["Courier accepted", "A courier accepted your delivery."],
      picked_up: ["Parcel picked up", "Your delivery is on the way."],
      on_the_way: ["Courier on the way", "Your delivery is moving to the destination."],
      delivered: ["Delivery complete", "Your VASI delivery has arrived."],
      cancelled: ["Delivery cancelled", "Your VASI delivery was cancelled."],
      canceled: ["Delivery cancelled", "Your VASI delivery was cancelled."],
    },
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function getPreferences() {
    return { promotions: false, sound: true, ...readJson(PREFS_KEY, {}) };
  }

  function getHistory() {
    const entries = readJson(HISTORY_KEY, []);
    return Array.isArray(entries) ? entries : [];
  }

  function categoryFromTag(tag) {
    const value = String(tag || "");
    if (value.includes("call")) return "call";
    if (value.includes("restaurant")) return "restaurant";
    if (value.includes("offer") || value.includes("job")) return "jobs";
    if (value.includes("eats")) return "eats";
    if (value.includes("delivery")) return "delivery";
    if (value.includes("ride")) return "ride";
    if (value.includes("promotion")) return "promotions";
    return "general";
  }

  function categoryIcon(category) {
    return { call: "📞", ride: "🚕", eats: "🍽️", delivery: "🛵", jobs: "📍", restaurant: "🧾", promotions: "🏷️", general: "🔔" }[category] || "🔔";
  }

  function shouldNotify(key, value) {
    const storageKey = `vasi-notification:${key}`;
    try {
      if (localStorage.getItem(storageKey) === value) return false;
      localStorage.setItem(storageKey, value);
    } catch (_) {}
    return true;
  }

  function saveHistoryEntry(title, body, url, tag, category) {
    if (tag === "vasi-alerts-enabled") return;
    const history = getHistory();
    const id = tag || `vasi-${Date.now()}`;
    if (history.some((item) => item.id === id)) return;
    history.unshift({ id, title, body, url: appUrl(url || "activity.html"), category, createdAt: new Date().toISOString(), read: false });
    writeJson(HISTORY_KEY, history.slice(0, HISTORY_LIMIT));
    renderCentre();
  }

  function markAllRead() {
    writeJson(HISTORY_KEY, getHistory().map((item) => ({ ...item, read: true })));
    renderCentre();
  }

  function markRead(id) {
    writeJson(HISTORY_KEY, getHistory().map((item) => item.id === id ? { ...item, read: true } : item));
    renderCentre();
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Now";
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function addStyles() {
    if (document.getElementById("vasi-notification-styles")) return;
    const style = document.createElement("style");
    style.id = "vasi-notification-styles";
    style.textContent = `
      .vasi-notification-backdrop{position:fixed;z-index:10000;inset:0;display:none;background:#000a;backdrop-filter:blur(6px)}.vasi-notification-backdrop[data-open="true"]{display:block}.vasi-notification-sheet{position:absolute;right:0;top:0;width:min(100%,430px);height:100%;display:flex;flex-direction:column;background:#0d0d0d;color:#fff;border-left:1px solid #303030;font-family:system-ui,-apple-system,sans-serif;box-shadow:-20px 0 60px #0009}
      .vasi-centre-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:max(18px,env(safe-area-inset-top)) 18px 15px;border-bottom:1px solid #292929}.vasi-centre-head h2{margin:0;font-size:25px;letter-spacing:-.7px}.vasi-centre-actions{display:flex;gap:8px;align-items:center}.vasi-centre-action{min-height:40px;border:1px solid #353535;border-radius:999px;background:#191919;color:#fff;padding:0 12px;font-weight:800;cursor:pointer}.vasi-centre-close{width:40px;padding:0;font-size:21px}
      .vasi-centre-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 18px;border-bottom:1px solid #242424}.vasi-centre-tab{min-height:42px;border:1px solid #303030;border-radius:13px;background:#151515;color:#aaa;font-weight:850;cursor:pointer}.vasi-centre-tab[aria-selected="true"]{background:#fff;color:#080808;border-color:#fff}.vasi-centre-body{overflow:auto;flex:1;padding:12px 14px calc(28px + env(safe-area-inset-bottom))}
      .vasi-empty{margin:36px 4px;border:1px dashed #343434;border-radius:20px;padding:32px 20px;color:#969696;text-align:center;line-height:1.5}.vasi-notification-item{width:100%;display:grid;grid-template-columns:44px 1fr auto;gap:11px;text-align:left;border:1px solid #292929;border-radius:18px;background:#141414;color:#fff;padding:14px;margin:0 0 9px;cursor:pointer}.vasi-notification-item[data-read="false"]{border-color:#555;background:#1a1a1a}.vasi-notification-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#242424;font-size:20px}.vasi-notification-copy{min-width:0}.vasi-notification-copy strong,.vasi-notification-copy span{display:block}.vasi-notification-copy strong{font-size:15px}.vasi-notification-copy span{margin-top:4px;color:#aaa;font-size:13px;line-height:1.4}.vasi-notification-time{color:#898989;font-size:11px;white-space:nowrap}.vasi-unread-dot{display:block;width:8px;height:8px;margin:7px 0 0 auto;border-radius:50%;background:#4e8cff}
      .vasi-settings-intro{margin:5px 4px 15px;color:#aaa;font-size:14px;line-height:1.5}.vasi-setting-row{display:flex;align-items:center;gap:14px;border-bottom:1px solid #292929;padding:17px 5px}.vasi-setting-copy{min-width:0;flex:1}.vasi-setting-copy strong,.vasi-setting-copy span{display:block}.vasi-setting-copy span{margin-top:4px;color:#929292;font-size:12px;line-height:1.4}.vasi-setting-required{border-radius:999px;background:#213323;color:#a8e4af;padding:6px 9px;font-size:10px;font-weight:900;text-transform:uppercase}.vasi-switch{position:relative;width:50px;height:30px;flex:0 0 50px}.vasi-switch input{position:absolute;opacity:0;pointer-events:none}.vasi-switch span{position:absolute;inset:0;border-radius:999px;background:#464646;cursor:pointer;transition:.2s}.vasi-switch span:after{content:"";position:absolute;width:24px;height:24px;left:3px;top:3px;border-radius:50%;background:#fff;transition:.2s}.vasi-switch input:checked+span{background:#2d8a49}.vasi-switch input:checked+span:after{transform:translateX(20px)}
      .vasi-permission-card{margin-top:18px;border:1px solid #343434;border-radius:18px;background:#161616;padding:16px}.vasi-permission-card p{margin:0 0 12px;color:#aaa;font-size:13px;line-height:1.45}.vasi-permission-card button{width:100%;min-height:46px;border:0;border-radius:13px;background:#fff;color:#050505;font-weight:900;cursor:pointer}
      .vasi-urgent{position:fixed;z-index:10001;inset:0;display:none;place-items:center;background:#000d;padding:22px}.vasi-urgent[data-open="true"]{display:grid}.vasi-urgent-card{width:min(100%,430px);border:2px solid #fff;border-radius:28px;background:#111;color:#fff;padding:24px;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 70px #000}.vasi-urgent-icon{font-size:36px}.vasi-urgent-card h2{margin:12px 0 8px;font-size:30px}.vasi-urgent-card p{margin:0;color:#aaa;line-height:1.5}.vasi-urgent-count{margin:18px 0;color:#ddd;font-weight:800}.vasi-urgent-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:10px}.vasi-urgent-actions button{min-height:52px;border:1px solid #393939;border-radius:16px;background:#1b1b1b;color:#fff;font-weight:900;cursor:pointer}.vasi-urgent-actions .vasi-open-job{background:#fff;color:#050505;border-color:#fff}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    addStyles();
    if (!document.getElementById("vasiNotificationCentre")) {
      const centre = document.createElement("div");
      centre.id = "vasiNotificationCentre";
      centre.className = "vasi-notification-backdrop";
      centre.setAttribute("role", "dialog");
      centre.setAttribute("aria-modal", "true");
      centre.setAttribute("aria-label", "VASI notifications");
      centre.innerHTML = '<section class="vasi-notification-sheet"><header class="vasi-centre-head"><h2>Notifications</h2><div class="vasi-centre-actions"><button id="vasiMarkRead" class="vasi-centre-action" type="button">Mark all read</button><button id="vasiCentreClose" class="vasi-centre-action vasi-centre-close" type="button" aria-label="Close">×</button></div></header><div class="vasi-centre-tabs"><button class="vasi-centre-tab" data-tab="notifications" aria-selected="true" type="button">Updates</button><button class="vasi-centre-tab" data-tab="settings" aria-selected="false" type="button">Settings</button></div><div id="vasiCentreBody" class="vasi-centre-body"></div></section>';
      centre.onclick = (event) => { if (event.target === centre) closeCentre(); };
      document.body.appendChild(centre);
      document.getElementById("vasiCentreClose").onclick = closeCentre;
      document.getElementById("vasiMarkRead").onclick = markAllRead;
      centre.querySelectorAll(".vasi-centre-tab").forEach((button) => { button.onclick = () => selectTab(button.dataset.tab); });
    }
    if (!document.getElementById("vasiUrgentAlert")) {
      const urgent = document.createElement("div");
      urgent.id = "vasiUrgentAlert";
      urgent.className = "vasi-urgent";
      urgent.setAttribute("role", "alertdialog");
      urgent.setAttribute("aria-modal", "true");
      urgent.innerHTML = '<section class="vasi-urgent-card"><div class="vasi-urgent-icon">📍</div><h2 id="vasiUrgentTitle">New request</h2><p id="vasiUrgentBody"></p><div id="vasiUrgentCount" class="vasi-urgent-count"></div><div class="vasi-urgent-actions"><button id="vasiUrgentDismiss" type="button">Dismiss</button><button id="vasiUrgentOpen" class="vasi-open-job" type="button">Open request</button></div></section>';
      document.body.appendChild(urgent);
      document.getElementById("vasiUrgentDismiss").onclick = closeUrgent;
    }
    renderCentre();
  }

  function selectTab(tab) {
    const centre = document.getElementById("vasiNotificationCentre");
    if (!centre) return;
    centre.dataset.tab = tab;
    centre.querySelectorAll(".vasi-centre-tab").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
    document.getElementById("vasiMarkRead").style.display = tab === "notifications" ? "block" : "none";
    renderCentre();
  }

  function openCentre(tab = "notifications") {
    ensureUi();
    const centre = document.getElementById("vasiNotificationCentre");
    centre.dataset.open = "true";
    document.body.style.overflow = "hidden";
    selectTab(tab);
    document.getElementById("vasiCentreClose")?.focus();
  }

  function closeCentre() {
    const centre = document.getElementById("vasiNotificationCentre");
    if (centre) centre.dataset.open = "false";
    document.body.style.overflow = "";
  }

  function renderCentre() {
    const centre = document.getElementById("vasiNotificationCentre");
    const body = document.getElementById("vasiCentreBody");
    if (!centre || !body) return;
    if (centre.dataset.tab === "settings") renderSettings(body);
    else renderHistory(body);
  }

  function renderHistory(body) {
    const history = getHistory();
    if (!history.length) { body.innerHTML = '<div class="vasi-empty">No updates yet.<br>Ride, Eats and Delivery alerts will appear here.</div>'; return; }
    body.innerHTML = "";
    history.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vasi-notification-item";
      button.dataset.read = String(Boolean(item.read));
      button.innerHTML = `<span class="vasi-notification-icon" aria-hidden="true">${categoryIcon(item.category)}</span><span class="vasi-notification-copy"><strong></strong><span></span></span><span class="vasi-notification-time">${timeLabel(item.createdAt)}${item.read ? "" : '<i class="vasi-unread-dot"></i>'}</span>`;
      button.querySelector("strong").textContent = item.title || "VASI update";
      button.querySelector(".vasi-notification-copy span").textContent = item.body || "";
      button.onclick = () => { markRead(item.id); if (item.url) location.href = item.url; };
      body.appendChild(button);
    });
  }

  function renderSettings(body) {
    const prefs = getPreferences();
    body.innerHTML = '<p class="vasi-settings-intro">Important trip, order and safety updates stay on. You can control optional alerts below.</p>';
    [["🚕", "Ride updates", "Driver accepted, arriving, trip started and completed"], ["🍽️", "Eats updates", "Restaurant and courier order progress"], ["🛵", "Delivery updates", "Courier accepted, pickup and delivery progress"], ["📍", "Work requests", "New driver, courier and restaurant requests"]].forEach(([icon, title, copy]) => {
      const row = document.createElement("div");
      row.className = "vasi-setting-row";
      row.innerHTML = `<span class="vasi-notification-icon" aria-hidden="true">${icon}</span><span class="vasi-setting-copy"><strong>${title}</strong><span>${copy}</span></span><span class="vasi-setting-required">Required</span>`;
      body.appendChild(row);
    });
    [["promotions", "🏷️", "Offers & promotions", "Discounts and optional VASI news", prefs.promotions], ["sound", "🔊", "Sound & vibration", "Use your device alert sound when supported", prefs.sound]].forEach(([key, icon, title, copy, checked]) => {
      const row = document.createElement("div");
      row.className = "vasi-setting-row";
      row.innerHTML = `<span class="vasi-notification-icon" aria-hidden="true">${icon}</span><span class="vasi-setting-copy"><strong>${title}</strong><span>${copy}</span></span><label class="vasi-switch" aria-label="${title}"><input type="checkbox" ${checked ? "checked" : ""}><span></span></label>`;
      row.querySelector("input").onchange = (event) => writeJson(PREFS_KEY, { ...getPreferences(), [key]: event.target.checked });
      body.appendChild(row);
    });
    const permission = document.createElement("div");
    permission.className = "vasi-permission-card";
    const supported = "Notification" in window;
    const permissionText = !supported ? "Install VASI on your Home Screen to receive phone alerts." : Notification.permission === "granted" ? "Phone notifications are enabled on this device." : Notification.permission === "denied" ? "Phone notifications are blocked in your device settings." : "Enable phone notifications so important updates can appear outside VASI.";
    permission.innerHTML = `<p>${permissionText}</p><button type="button">${supported && Notification.permission === "granted" ? "Alerts enabled" : "Enable phone alerts"}</button>`;
    permission.querySelector("button").disabled = supported && Notification.permission === "granted";
    permission.querySelector("button").onclick = requestPermission;
    body.appendChild(permission);
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    if (!registrationPromise) registrationPromise = navigator.serviceWorker.register(appUrl("sw.js"), { scope: APP_BASE.pathname }).then(() => navigator.serviceWorker.ready).catch(() => null);
    return registrationPromise;
  }

  async function show(title, body, url, tag) {
    const category = categoryFromTag(tag);
    if (category === "promotions" && !getPreferences().promotions) return;
    saveHistoryEntry(title, body, url, tag, category);
    if ((category === "call" || category === "jobs" || category === "restaurant") && document.visibilityState === "visible") showUrgent(title, body, url);
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const registration = await registerWorker();
    const prefs = getPreferences();
    const options = { body, icon: appUrl("vasi-icon.svg"), badge: appUrl("vasi-icon.svg"), tag: tag || "vasi-update", renotify: false, silent: !prefs.sound, vibrate: prefs.sound ? [180, 80, 180] : [], data: { url: appUrl(url || "activity.html") } };
    if (registration?.showNotification) await registration.showNotification(title, options);
    else new Notification(title, options);
  }

  function showUrgent(title, body, url) {
    ensureUi();
    closeUrgent();
    const urgent = document.getElementById("vasiUrgentAlert");
    document.getElementById("vasiUrgentTitle").textContent = title;
    document.getElementById("vasiUrgentBody").textContent = body;
    document.getElementById("vasiUrgentOpen").onclick = () => { location.href = appUrl(url || "activity.html"); };
    urgent.dataset.open = "true";
    let remaining = 20;
    const count = document.getElementById("vasiUrgentCount");
    count.textContent = `Open within ${remaining} seconds`;
    urgentTimer = setInterval(() => { remaining -= 1; count.textContent = `Open within ${Math.max(0, remaining)} seconds`; if (remaining <= 0) closeUrgent(); }, 1000);
  }

  function closeUrgent() {
    if (urgentTimer) clearInterval(urgentTimer);
    urgentTimer = null;
    const urgent = document.getElementById("vasiUrgentAlert");
    if (urgent) urgent.dataset.open = "false";
  }

  async function requestPermission() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (ios && !standalone) {
      alert("On iPhone, tap Share → Add to Home Screen. Open VASI from the Home Screen, then enable alerts.");
      return false;
    }
    if (!("Notification" in window)) {
      if (ios) alert("Update iOS, then open the installed VASI app from your Home Screen to enable alerts.");
      else alert("Notifications are not supported in this browser.");
      return false;
    }
    if (Notification.permission === "denied") { alert("Notifications are blocked. Open your phone or browser Settings, allow notifications for VASI, then return here."); return false; }
    if (Notification.permission !== "granted") { try { await Notification.requestPermission(); } catch (_) {} }
    renderCentre();
    if (Notification.permission === "granted") await show("VASI alerts are on", "Ride, Eats and Delivery updates will appear here.", location.pathname, "vasi-alerts-enabled");
    else if (ios && !standalone) alert("On iPhone, add VASI to your Home Screen first, open it there, then enable alerts.");
    return Notification.permission === "granted";
  }

  function notifyStatus(kind, row) {
    const status = String(row?.status || "").toLowerCase();
    const copy = statusCopy[kind]?.[status];
    if (!copy) return;
    const id = String(row?.id || "");
    if (!shouldNotify(`${kind}:${id}`, status)) return;
    show(copy[0], copy[1], kind === "ride" && !["completed", "cancelled", "canceled"].includes(status) ? "/ride-flow.html" : "/activity.html", `vasi-${kind}-${id}-${status}`);
  }

  function listenCustomer(userId, channel) {
    [["rides", "ride"], ["eats_orders", "eats"], ["delivery_orders", "delivery"]].forEach(([table, kind]) => channel.on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `customer_id=eq.${userId}` }, (payload) => notifyStatus(kind, payload.new)));
  }

  function listenDriver(channel) {
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "vasi_dispatch_offers" }, (payload) => {
      if (payload.new?.service === "ride" && payload.new?.status === "pending" && shouldNotify(`ride-offer:${payload.new.id}`, "pending")) show("New ride request", "A nearby customer is waiting for a driver.", "/driver.html", `vasi-ride-offer-${payload.new.id}`);
    });
  }

  function listenRestaurant(channel) {
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "eats_orders" }, (payload) => {
      const id = payload.new?.id || Date.now();
      if (shouldNotify(`restaurant-order:${id}`, "new")) show("New VASI Eats order", "A customer placed a new food order.", "/restaurant-dashboard.html", `vasi-restaurant-order-${id}`);
    });
  }

  function listenCourier(channel) {
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_orders" }, (payload) => {
      const id = payload.new?.id || Date.now();
      if (shouldNotify(`delivery-job:${id}`, "new")) show("New delivery job", "A new parcel delivery is available.", "/delivery-driver.html", `vasi-delivery-job-${id}`);
    }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "eats_orders" }, (payload) => {
      if (payload.new?.status === "ready_for_pickup" && shouldNotify(`eats-job:${payload.new.id}`, "ready_for_pickup")) show("Food ready for pickup", "A VASI Eats order is ready for a courier.", "/delivery-driver.html", `vasi-eats-job-${payload.new.id}`);
    });
  }

  function listenVoiceCalls(userId, channel) {
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_call_signals" }, (payload) => {
      const row = payload.new;
      if (row?.signal_type !== "invite" || row.sender_id === userId || !row.ride_id || !row.call_id) return;
      const id = `voice-call:${row.call_id}`;
      if (!shouldNotify(id, "ringing")) return;
      const url = `/ride-chat.html?ride=${encodeURIComponent(row.ride_id)}&incoming=${encodeURIComponent(row.call_id)}`;
      show("Incoming VASI voice call", "Your ride partner is calling inside VASI.", url, `vasi-call-${row.call_id}`);
      navigator.vibrate?.([180, 90, 180, 90, 300]);
    });
  }

  async function subscribe() {
    if (!activeClient) return;
    const { data } = await activeClient.auth.getSession();
    const session = data?.session;
    if (!session) return;
    if (activeChannel) await activeClient.removeChannel(activeChannel);
    const channel = activeClient.channel(`${CHANNEL_PREFIX}:${activeRole}:${session.user.id}`);
    listenVoiceCalls(session.user.id, channel);
    if (activeRole === "driver") listenDriver(channel);
    else if (activeRole === "courier") listenCourier(channel);
    else if (activeRole === "restaurant") listenRestaurant(channel);
    else listenCustomer(session.user.id, channel);
    activeChannel = channel.subscribe();
  }

  async function start(client, options = {}) {
    if (!client) return;
    activeClient = client;
    activeRole = options.role || "customer";
    ensureUi();
    await registerWorker();
    await subscribe();
    client.auth.onAuthStateChange(() => setTimeout(subscribe, 0));
  }

  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeUrgent(); closeCentre(); } });
  window.VasiNotifications = { start, requestPermission, show, openCentre, openSettings: () => openCentre("settings") };
})();
