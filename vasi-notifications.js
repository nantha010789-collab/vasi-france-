(function () {
  "use strict";

  const CHANNEL_PREFIX = "vasi-live-alerts";
  let activeClient = null;
  let activeChannel = null;
  let activeRole = "customer";
  let registrationPromise = null;

  function shouldNotify(key, value) {
    const storageKey = `vasi-notification:${key}`;
    try {
      if (localStorage.getItem(storageKey) === value) return false;
      localStorage.setItem(storageKey, value);
    } catch (_) {}
    return true;
  }

  const statusCopy = {
    ride: {
      requested: ["Ride requested", "VASI is finding a nearby driver."],
      accepted: ["Driver accepted", "Your VASI driver is on the way."],
      driver_arriving: [
        "Driver has arrived",
        "Your driver is waiting at the pickup point.",
      ],
      in_progress: ["Ride started", "Your VASI trip is now in progress."],
      completed: [
        "Ride completed",
        "Your trip is complete. Your receipt is ready.",
      ],
      cancelled: ["Ride cancelled", "This VASI ride has been cancelled."],
      canceled: ["Ride cancelled", "This VASI ride has been cancelled."],
    },
    eats: {
      pending: [
        "Order placed",
        "Your VASI Eats order was sent to the restaurant.",
      ],
      accepted: ["Restaurant accepted", "The restaurant accepted your order."],
      preparing: [
        "Food is being prepared",
        "Your VASI Eats order is in the kitchen.",
      ],
      ready_for_pickup: [
        "Order ready",
        "Your food is ready for courier pickup.",
      ],
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
      on_the_way: [
        "Courier on the way",
        "Your delivery is moving to the destination.",
      ],
      delivered: ["Delivery complete", "Your VASI delivery has arrived."],
      cancelled: ["Delivery cancelled", "Your VASI delivery was cancelled."],
      canceled: ["Delivery cancelled", "Your VASI delivery was cancelled."],
    },
  };

  function addStyles() {
    if (document.getElementById("vasi-notification-styles")) return;
    const style = document.createElement("style");
    style.id = "vasi-notification-styles";
    style.textContent = `
      .vasi-alert-button{position:fixed;z-index:9998;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));min-height:46px;border:1px solid #3a3a3a;border-radius:999px;padding:0 16px;background:#fff;color:#050505;font:800 14px/1 system-ui,-apple-system,sans-serif;box-shadow:0 12px 34px #0008;cursor:pointer}
      .vasi-alert-button[data-state="on"]{background:#151515;color:#fff}
      .vasi-alert-button[data-state="blocked"]{background:#381616;color:#ffd4d4;border-color:#713030}
      @media(min-width:800px){.vasi-alert-button{right:24px;bottom:24px}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    addStyles();
    let button = document.getElementById("vasiAlertButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "vasiAlertButton";
      button.type = "button";
      button.className = "vasi-alert-button";
      button.setAttribute("aria-live", "polite");
      document.body.appendChild(button);
    }
    paintButton(button);
    button.onclick = requestPermission;
    return button;
  }

  function paintButton(button = document.getElementById("vasiAlertButton")) {
    if (!button) return;
    if (!("Notification" in window)) {
      button.dataset.state = "blocked";
      button.textContent = "🔔 Install for alerts";
      return;
    }
    if (Notification.permission === "granted") {
      button.dataset.state = "on";
      button.textContent = "🔔 Alerts on";
    } else if (Notification.permission === "denied") {
      button.dataset.state = "blocked";
      button.textContent = "🔕 Alerts blocked";
    } else {
      button.dataset.state = "off";
      button.textContent = "🔔 Enable alerts";
    }
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .catch(() => null);
    }
    return registrationPromise;
  }

  async function show(title, body, url, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    const registration = await registerWorker();
    const options = {
      body,
      icon: "/vasi-icon.svg",
      badge: "/vasi-icon.svg",
      tag: tag || "vasi-update",
      renotify: false,
      data: { url: url || "/activity.html" },
    };
    if (registration?.showNotification)
      await registration.showNotification(title, options);
    else new Notification(title, options);
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        alert(
          "On iPhone, tap Share → Add to Home Screen. Then open VASI from the Home Screen and enable alerts.",
        );
      } else {
        alert("Notifications are not supported in this browser.");
      }
      return;
    }
    if (Notification.permission === "denied") {
      alert(
        "Notifications are blocked. Open your phone or browser Settings, allow notifications for VASI, then return here.",
      );
      return;
    }
    if (Notification.permission !== "granted") {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }
    paintButton();
    if (Notification.permission === "granted") {
      await show(
        "VASI alerts are on",
        "Ride, Eats and Delivery updates will appear here.",
        location.pathname,
        "vasi-alerts-enabled",
      );
    } else if (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches
    ) {
      alert(
        "On iPhone, add VASI to your Home Screen first, open it there, then enable alerts.",
      );
    }
  }

  function notifyStatus(kind, row) {
    const status = String(row?.status || "").toLowerCase();
    const copy = statusCopy[kind]?.[status];
    if (!copy) return;
    const id = String(row?.id || "");
    if (!shouldNotify(`${kind}:${id}`, status)) return;
    show(
      copy[0],
      copy[1],
      kind === "ride" &&
        !["completed", "cancelled", "canceled"].includes(status)
        ? "/ride-flow.html"
        : "/activity.html",
      `vasi-${kind}-${id}-${status}`,
    );
  }

  function listenCustomer(client, userId, channel) {
    [
      ["rides", "ride"],
      ["eats_orders", "eats"],
      ["delivery_orders", "delivery"],
    ].forEach(([table, kind]) => {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => notifyStatus(kind, payload.new),
      );
    });
  }

  function listenDriver(channel) {
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vasi_dispatch_offers" },
      (payload) => {
        if (
          payload.new?.service === "ride" &&
          payload.new?.status === "pending" &&
          shouldNotify(`ride-offer:${payload.new.id}`, "pending")
        )
          show(
            "New ride request",
            "A nearby customer is waiting for a driver.",
            "/driver.html",
            `vasi-ride-offer-${payload.new.id}`,
          );
      },
    );
  }

  function listenRestaurant(channel) {
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "eats_orders" },
      (payload) => {
        const id = payload.new?.id || Date.now();
        if (shouldNotify(`restaurant-order:${id}`, "new"))
          show(
            "New VASI Eats order",
            "A customer placed a new food order.",
            "/restaurant-dashboard.html",
            `vasi-restaurant-order-${id}`,
          );
      },
    );
  }

  function listenCourier(channel) {
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_orders" },
        (payload) => {
          const id = payload.new?.id || Date.now();
          if (shouldNotify(`delivery-job:${id}`, "new"))
            show(
              "New delivery job",
              "A new parcel delivery is available.",
              "/delivery-driver.html",
              `vasi-delivery-job-${id}`,
            );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "eats_orders" },
        (payload) => {
          if (
            payload.new?.status === "ready_for_pickup" &&
            shouldNotify(`eats-job:${payload.new.id}`, "ready_for_pickup")
          )
            show(
              "Food ready for pickup",
              "A VASI Eats order is ready for a courier.",
              "/delivery-driver.html",
              `vasi-eats-job-${payload.new.id}`,
            );
        },
      );
  }

  async function subscribe() {
    if (!activeClient) return;
    const { data } = await activeClient.auth.getSession();
    const session = data?.session;
    if (!session) return;
    if (activeChannel) await activeClient.removeChannel(activeChannel);
    const channel = activeClient.channel(
      `${CHANNEL_PREFIX}:${activeRole}:${session.user.id}`,
    );
    if (activeRole === "driver") listenDriver(channel);
    else if (activeRole === "courier") listenCourier(channel);
    else if (activeRole === "restaurant") listenRestaurant(channel);
    else listenCustomer(activeClient, session.user.id, channel);
    activeChannel = channel.subscribe();
  }

  async function start(client, options = {}) {
    if (!client) return;
    activeClient = client;
    activeRole = options.role || "customer";
    ensureButton();
    await registerWorker();
    await subscribe();
    client.auth.onAuthStateChange(() => setTimeout(subscribe, 0));
  }

  window.VasiNotifications = { start, requestPermission, show };
})();