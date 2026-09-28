(() => {
  "use strict";
  const PREFIX = "vasi-net:";
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowTypes = new Set(["slow-2g","2g","3g"]);
  const isSlow = () => Boolean(connection?.saveData || slowTypes.has(connection?.effectiveType));
  const isOnline = () => navigator.onLine !== false;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const cacheGet = (key, maxAge, allowStale) => {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      const age = Date.now() - Number(entry.savedAt || 0);
      if (!allowStale && age > maxAge) return null;
      return { data: entry.data, stale: age > maxAge, age };
    } catch (_) { return null; }
  };
  const cachePut = (key, data) => {
    if (!key) return;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  };
  async function json(url, options = {}, config = {}) {
    const timeout = Number(config.timeout || (isSlow() ? 9500 : 6500));
    const retries = Number(config.retries ?? (isSlow() ? 2 : 1));
    const cacheKey = config.cacheKey || "";
    const maxAge = Number(config.maxAge || 6 * 60 * 60 * 1000);
    const allowStale = config.allowStale !== false;
    const cached = cacheGet(cacheKey, maxAge, allowStale);
    if (!isOnline() && cached) return { ok: true, status: 200, data: cached.data, fromCache: true, stale: true };
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Network request failed");
        cachePut(cacheKey, data);
        return { ok: true, status: response.status, data, fromCache: false, stale: false };
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        if (attempt < retries && isOnline()) await sleep(350 * (attempt + 1));
      }
    }
    if (cached) return { ok: true, status: 200, data: cached.data, fromCache: true, stale: true };
    throw lastError || new Error("Network unavailable");
  }
  const rad = (n) => Number(n) * Math.PI / 180;
  function haversineKm(a, b) {
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const lat1 = rad(a[0]), lat2 = rad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function approximateRoute(points) {
    let direct = 0;
    for (let i = 1; i < points.length; i += 1) direct += haversineKm(points[i - 1], points[i]);
    const km = Math.max(0.2, direct * 1.28);
    const mins = Math.max(2, Math.round((km / 24) * 60));
    return {
      distance_km: km,
      duration_min: mins,
      geometry: { type: "LineString", coordinates: points.map((p) => [p[1], p[0]]) },
      approximate: true,
    };
  }
  window.VasiNet = { json, isSlow, isOnline, haversineKm, approximateRoute };
})();