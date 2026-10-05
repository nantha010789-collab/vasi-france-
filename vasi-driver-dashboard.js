(function () {
  "use strict";

  let homeMap = null;
  let homeMarker = null;
  let offerTimer = null;
  let toastTimer = null;

  const defaultCenter = [48.8566, 2.3522];
  const byId = (id) => document.getElementById(id);
  const localText = (fr, en) => window.VasiLanguage?.getLanguage?.() === "en" ? en : fr;
  const dayKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  const safe = (value) =>
    typeof esc === "function"
      ? esc(value)
      : String(value ?? "").replace(/[&<>"']/g, (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]);

  function addHomeTiles(map) {
    const proxy = L.tileLayer("/api/map-tile?z={z}&x={x}&y={y}", {
      maxZoom: 19,
      keepBuffer: 5,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    const publicTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 3,
      attribution: "© OpenStreetMap",
    });
    let failures = 0;
    proxy.on("tileerror", () => {
      failures += 1;
      if (failures >= 2 && navigator.onLine !== false && !map.hasLayer(publicTiles)) {
        publicTiles.addTo(map);
      }
    });
    proxy.on("tileload", () => {
      failures = 0;
      if (map.hasLayer(publicTiles)) map.removeLayer(publicTiles);
    });
  }

  function initDriverHomeMap() {
    if (homeMap || !window.L || !byId("driverHomeMap")) return;
    homeMap = L.map("driverHomeMap", {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView(defaultCenter, 11);
    addHomeTiles(homeMap);
    L.control.zoom({ position: "bottomleft" }).addTo(homeMap);
    setTimeout(() => homeMap?.invalidateSize({ animate: false }), 80);
  }

  window.updateHomeMapPosition = function updateHomeMapPosition(position) {
    initDriverHomeMap();
    if (!homeMap || !position?.coords) return;
    const point = [Number(position.coords.latitude), Number(position.coords.longitude)];
    if (!point.every(Number.isFinite)) return;
    const icon = L.divIcon({
      className: "",
      html: '<div class="driverMapCar" style="--driver-heading:' + Number(position.coords.heading || 0) + 'deg"><span class="driverMapHeading"></span><span class="driverMapCarEmoji">🚘</span></div>',
      iconSize: [43, 43],
      iconAnchor: [21, 21],
    });
    if (!homeMarker) homeMarker = L.marker(point, { icon, zIndexOffset: 500 }).addTo(homeMap);
    else homeMarker.setLatLng(point).setIcon(icon);
    if (homeMap.getZoom() < 14) homeMap.setZoom(14, { animate: false });
    homeMap.panTo(point, { animate: true });
  };

  window.recenterHomeMap = function recenterHomeMap() {
    initDriverHomeMap();
    if (typeof lastPos !== "undefined" && lastPos?.coords) {
      window.updateHomeMapPosition(lastPos);
      return;
    }
    homeMap?.setView(defaultCenter, 11, { animate: true });
    window.showDriverToast("Passez en ligne pour afficher votre position GPS.");
  };

  window.showDriverView = function showDriverView(name) {
    const view = document.querySelector('[data-driver-view="' + name + '"]');
    if (!view) return;
    const activeTab = name === "discover" ? "menu" : name;
    document.querySelectorAll("[data-driver-view]").forEach((element) => {
      element.classList.toggle("is-active", element === view);
    });
    document.querySelectorAll("[data-driver-tab]").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.driverTab === activeTab);
      if (element.dataset.driverTab === activeTab) element.setAttribute("aria-current", "page");
      else element.removeAttribute("aria-current");
    });
    try { sessionStorage.setItem("vasi_driver_view", name); } catch (_) {}
    document.querySelector("[data-scroll-region]")?.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "home") setTimeout(() => homeMap?.invalidateSize({ animate: false }), 60);
    if (name === "discover" && typeof window.loadPlannedRides === "function") window.loadPlannedRides();
  };

  window.showDriverToast = function showDriverToast(message, isError) {
    const toast = byId("driverToast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
  };

  window.syncDriverDashboardState = function syncDriverDashboardState(state) {
    const isOnline = Boolean(state?.online);
    const hasRide = Boolean(state?.activeRide);
    byId("searchingStrip")?.classList.toggle("is-visible", isOnline && !hasRide);
    byId("toggle")?.classList.toggle("is-online", isOnline);
    const hint = byId("onlineHint");
    if (hint) hint.textContent = hasRide ? localText("Navigation de la course active", "Active ride navigation") : isOnline ? localText("Demandes en temps réel activées", "Live ride requests enabled") : localText("Passez en ligne pour recevoir des courses", "Go online to receive rides");
    const blocker = byId("onlineBlocker"), action = byId("onlineBlockerAction");
    const needsBank = !hasRide && !isOnline && state?.payoutReady === false;
    if (blocker) blocker.hidden = !hasRide && !needsBank;
    if (action) action.hidden = !needsBank;
    const explanation = byId("onlineBlockerText");
    if (explanation) explanation.textContent = hasRide
      ? localText("Terminez votre course avant de changer votre disponibilité.", "Finish your ride before changing your availability.")
      : needsBank ? localText("Votre RIB doit être vérifié avant de passer en ligne.", "Your bank account must be verified before going online.") : "";
    if (action) action.textContent = localText("Connecter mon RIB", "Connect bank account");
  };

  window.updateDriverProfile = function updateDriverProfile(profile) {
    if (!profile) return;
    const name = String(profile.full_name || "Chauffeur VASI").trim();
    const vehicle = [profile.vehicle_make, profile.vehicle_model, profile.vehicle_plate]
      .filter(Boolean).join(" · ") || "Véhicule en vérification";
    const rating = Number(profile.rating);
    if (byId("driverName")) byId("driverName").textContent = name;
    if (byId("driverVehicle")) byId("driverVehicle").textContent = vehicle;
    if (byId("driverInitial")) byId("driverInitial").textContent = (name[0] || "V").toUpperCase();
    if (byId("driverRating")) byId("driverRating").textContent = Number.isFinite(rating) && rating > 0 ? "★ " + rating.toFixed(2) : "★ —";
    if (byId("homeRating")) byId("homeRating").textContent = Number.isFinite(rating) && rating > 0 ? rating.toFixed(2) : "—";
  };

  window.renderEarningsChart = function renderEarningsChart(rows) {
    const chart = byId("earningsChart");
    if (!chart) return;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { key: dayKey(date), label: date.toLocaleDateString(localText("fr-FR", "en-GB"), { weekday: "short" }).slice(0, 2), value: 0 };
    });
    for (const row of rows || []) {
      const date = new Date(row.created_at);
      if (!Number.isFinite(date.getTime())) continue;
      const key = dayKey(date);
      const day = days.find((entry) => entry.key === key);
      const amount = Number(row.driver_earnings || 0);
      if (day && Number.isFinite(amount)) day.value += amount;
    }
    if (!days.some((day) => day.value > 0)) {
      chart.classList.add("is-empty");
      chart.innerHTML = '<p class="muted" data-en="No earnings recorded in the last 7 days.">Aucun revenu enregistré sur les 7 derniers jours.</p>';
      return;
    }
    chart.classList.remove("is-empty");
    const max = Math.max(1, ...days.map((day) => day.value));
    chart.innerHTML = days.map((day) =>
      '<i class="earnings-bar" style="--bar-height:' + Math.max(0, (day.value / max) * 100).toFixed(1) + '%" title="' + safe(day.value.toFixed(2) + " €") + '"><span>' + safe(day.label) + "</span></i>"
    ).join("");
  };

  window.updateDemandSummary = function updateDemandSummary(zones) {
    const summary = byId("homeDemandSummary");
    if (!summary) return;
    const requests = (zones || []).reduce((total, zone) => total + Number(zone.requests || 0), 0);
    summary.innerHTML = requests > 0
      ? '<strong style="color:#fff">' + requests + " demande" + (requests > 1 ? "s" : "") + '</strong><br><span>Opportunités récentes dans les zones proches.</span>'
      : "Aucune zone active pour le moment. La demande sera actualisée automatiquement.";
  };

  function fareFor(ride) {
    const value = Number(ride.driver_amount || ride.estimated_fare || 0);
    return typeof money === "function" ? money(value) : value.toFixed(2) + " €";
  }

  function plannedCard(ride) {
    const confirmed = ride.reservation_state === "confirmed";
    const pickup = new Date(ride.scheduled_for);
    const date = pickup.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
    const time = pickup.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return '<article class="planned-card ' + (confirmed ? "confirmed" : "") + '">' +
      '<div class="planned-head"><div><span class="state-chip">' + (confirmed ? "Confirmée" : "Disponible") + '</span><strong style="display:block;margin-top:9px">' + safe(date + " · " + time) + '</strong></div><strong>' + safe(fareFor(ride)) + "</strong></div>" +
      '<div class="planned-route"><span>● ' + safe(ride.pickup_address || "Départ à confirmer") + '</span><span>■ ' + safe(ride.destination_address || "Destination à confirmer") + "</span></div>" +
      '<div class="offer-meta"><span>' + safe(ride.service || "VASI Go") + "</span><span>" + safe(ride.payment_method === "cash" ? "Espèces" : "Carte") + "</span>" + (ride.airport_pickup ? "<span>✈ Aéroport</span>" : "") + "</div>" +
      '<div class="planned-actions"><button class="btn ' + (confirmed ? "decline" : "accept") + '" type="button" onclick="' + (confirmed ? "releasePlannedRide" : "claimPlannedRide") + "('" + safe(ride.ride_id) + "')\">" + (confirmed ? "Libérer" : "Réserver") + "</button></div></article>";
  }

  window.loadPlannedRides = async function loadPlannedRides() {
    if (typeof providerApproved === "undefined" || !providerApproved) return;
    const target = byId("plannedRides");
    if (!target || typeof client === "undefined") return;
    target.innerHTML = '<p class="muted">Actualisation des courses planifiées…</p>';
    const { data, error } = await client.rpc("vasi_driver_planned_rides");
    if (error) {
      target.innerHTML = '<p class="muted">Les courses planifiées seront disponibles après validation du profil chauffeur.</p>';
      if (byId("plannedHomeSummary")) byId("plannedHomeSummary").textContent = "Aucune réservation confirmée.";
      return;
    }
    const rides = data || [];
    target.innerHTML = rides.length ? rides.map(plannedCard).join("") : '<p class="muted">Aucune course planifiée disponible pour le moment.</p>';
    const confirmed = rides.filter((ride) => ride.reservation_state === "confirmed");
    const summary = byId("plannedHomeSummary");
    if (summary) {
      summary.textContent = confirmed.length
        ? confirmed.length + " réservation" + (confirmed.length > 1 ? "s confirmées" : " confirmée") + ". Ouvrez Opportunités pour les détails."
        : rides.length + " course" + (rides.length > 1 ? "s disponibles" : " disponible") + " à réserver.";
    }
  };

  window.claimPlannedRide = async function claimPlannedRide(rideId) {
    if (!confirm("Réserver cette course planifiée ?")) return;
    const { error } = await client.rpc("vasi_driver_claim_planned_ride", { p_ride_id: rideId });
    if (error) return window.showDriverToast(error.message, true);
    window.showDriverToast("Course planifiée réservée.");
    await window.loadPlannedRides();
  };

  window.releasePlannedRide = async function releasePlannedRide(rideId) {
    if (!confirm("Libérer cette course planifiée ?")) return;
    const { error } = await client.rpc("vasi_driver_release_planned_ride", { p_ride_id: rideId });
    if (error) return window.showDriverToast(error.message, true);
    window.showDriverToast("Course planifiée libérée.");
    await window.loadPlannedRides();
  };

  window.startOfferCountdown = function startOfferCountdown(expiresAt) {
    clearInterval(offerTimer);
    const update = () => {
      const element = byId("offerCountdown");
      if (!element) return clearInterval(offerTimer);
      const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      element.textContent = seconds > 0 ? "Répondez dans " + seconds + " s" : "Offre expirée";
      if (seconds <= 0) {
        clearInterval(offerTimer);
        if (typeof loadPending === "function") loadPending();
      }
    };
    update();
    offerTimer = setInterval(update, 1000);
  };

  document.addEventListener("DOMContentLoaded", () => {
    initDriverHomeMap();
    let saved = "home";
    try { saved = sessionStorage.getItem("vasi_driver_view") || "home"; } catch (_) {}
    window.showDriverView(saved);
  });
  window.addEventListener("online", () => homeMap?.invalidateSize({ animate: false }));
  window.addEventListener("resize", () => homeMap?.invalidateSize({ animate: false }));
  window.addEventListener("pageshow", () => setTimeout(() => homeMap?.invalidateSize({ animate: false }), 80));
})();
