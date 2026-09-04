import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.VASI_SUPABASE_URL = "https://unit-test.supabase.co";
process.env.VASI_SUPABASE_ANON_KEY = "test-publishable-key";
process.env.STRIPE_SECRET_KEY = "sk_test_unit";

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("booking creates, prices and dispatches a ride", async () => {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.includes("vasi_pricing_settings")) return response([], 503);
    if (value.includes("router.project-osrm.org")) {
      return response({ routes: [{ distance: 10_000, duration: 1_200 }] });
    }
    if (value.includes("/api/customer-offer")) return response({}, 404);
    if (value.includes("/rpc/create_customer_ride")) {
      return response({ id: "ride-123", status: "requested" }, 201);
    }
    if (value.includes("/rpc/vasi_dispatch_ride")) return response(3);
    throw new Error(`Unexpected request: ${value}`);
  };
  const { default: createRide } = await import(`../api/create-ride.js?test=${Date.now()}`);
  const req = {
    method: "POST",
    headers: { authorization: "Bearer customer-token" },
    body: {
      pickup_address: "1 Rue de Paris, Creil",
      pickup_lat: 49.2583,
      pickup_lng: 2.4829,
      destination_address: "Gare de Creil",
      destination_lat: 49.264,
      destination_lng: 2.469,
      service: "VASI Go",
      payment_method: "cash",
    },
  };
  const res = mockRes();
  await createRide(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ride.id, "ride-123");
  assert.equal(res.body.offers_sent, 3);
  assert.ok(res.body.pricing.estimated_fare >= 7.5);
  const createCall = calls.find((item) => item.url.includes("create_customer_ride"));
  const payload = JSON.parse(createCall.options.body);
  assert.equal(payload.p_payment_method, "cash");
  assert.equal(payload.p_currency, "EUR");
});

test("completed cash ride returns a successful payment result", async () => {
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/rest/v1/rides?")) {
      return response([{ id: "ride-123", customer_id: "customer-1", driver_id: "driver-1", status: "completed", final_fare: 18.4, payment_method: "cash" }]);
    }
    if (value.endsWith("/auth/v1/user")) return response({ id: "driver-user" });
    if (value.includes("/rest/v1/drivers?")) return response([{ id: "driver-1" }]);
    throw new Error(`Unexpected request: ${value}`);
  };
  const { default: capturePayment } = await import(`../api/capture-payment.js?test=${Date.now()}`);
  const req = { method: "POST", headers: { authorization: "Bearer driver-token" }, body: { ride_id: "ride-123" } };
  const res = mockRes();
  await capturePayment(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, status: "cash", amount: 18.4, kind: "ride" });
});

test("VASI Eats validates a live menu and creates an order with delivery PIN", async () => {
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("/rest/v1/restaurants?")) {
      return response([{ id: "restaurant-1", name: "VASI Test Kitchen", cuisine: "French", preparation_minutes: 20, minimum_order: 8, delivery_fee: 2.5, delivery_mode: "vasi" }]);
    }
    if (value.includes("/rest/v1/restaurant_menu_items?")) {
      return response([{ id: "item-1", restaurant_id: "restaurant-1", name: "Meal", category: "Menu", price: 10, allergens: [] }]);
    }
    if (value.endsWith("/auth/v1/user")) return response({ id: "customer-1" });
    if (value.includes("nominatim.openstreetmap.org")) return response([{ display_name: "1 Rue de Paris, 60100 Creil" }]);
    if (value.endsWith("/rest/v1/eats_orders") && options.method === "POST") return response([{ id: "order-123" }], 201);
    if (value.includes("/rest/v1/eats_order_safety?")) return response([{ delivery_pin: "2468" }]);
    throw new Error(`Unexpected request: ${value}`);
  };
  const { default: eatsOrder } = await import(`../api/eats-order.js?test=${Date.now()}`);
  const req = {
    method: "POST",
    headers: { authorization: "Bearer customer-token" },
    body: { action: "book", restaurant_id: "restaurant-1", items: [{ id: "item-1", quantity: 2 }], delivery_address: "1 Rue de Paris, Creil" },
  };
  const res = mockRes();
  await eatsOrder(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.order_id, "order-123");
  assert.equal(res.body.delivery_pin, "2468");
  assert.equal(res.body.total, 22.5);
});

test("voice-call ICE configuration requires an authenticated VASI user", async () => {
  global.fetch = async () => response({ id: "user-1" });
  const { default: callConfig } = await import(`../api/call-config.js?test=${Date.now()}`);
  const denied = mockRes();
  await callConfig({ method: "GET", headers: {} }, denied);
  assert.equal(denied.statusCode, 401);
  const allowed = mockRes();
  await callConfig({ method: "GET", headers: { authorization: "Bearer token" } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.ok(allowed.body.iceServers[0].urls.every((url) => url.startsWith("stun:")));
  assert.equal(allowed.headers["cache-control"], "private, no-store, max-age=0");
});

test("customer-to-driver lifecycle exposes call, payment and receipt contracts", async () => {
  const [chat, call, driver, history, worker, notifications, settings, auth, languages] = await Promise.all([
    readFile("ride-chat.html", "utf8"),
    readFile("vasi-call.js", "utf8"),
    readFile("driver.html", "utf8"),
    readFile("ride-history.html", "utf8"),
    readFile("sw.js", "utf8"),
    readFile("vasi-notifications.js", "utf8"),
    readFile("settings.html", "utf8"),
    readFile("auth.html", "utf8"),
    readFile("vasi-languages.js", "utf8"),
  ]);
  assert.match(chat, /vasi-call\.js/);
  assert.match(call, /RTCPeerConnection/);
  assert.match(call, /ride_call_signals/);
  assert.match(call, /getUserMedia/);
  for (const action of ["arrive", "start", "complete"]) assert.match(driver, new RegExp(`tripAction\\('${action}'\\)`));
  assert.match(driver, /capture-payment/);
  assert.match(history, /get_customer_ride_history_v2/);
  assert.match(history, /class="receipt"/);
  assert.match(worker, /vasi-call\.js/);
  assert.match(notifications, /listenVoiceCalls/);
  assert.match(notifications, /signal_type.*invite/s);
  assert.match(settings, /id="testNotification"/);
  assert.match(settings, /VASI test successful/);
  assert.match(auth, /vasi_pending_phone/);
  assert.match(auth, /otp_expired/);
  assert.match(auth, /startResendCountdown\(0\)/);
  for (const language of ["fr", "en", "ta", "de", "ar", "hi"]) assert.match(languages, new RegExp(`\\b${language}:`));
});

test("customer, driver, restaurant and admin surfaces load the shared language runtime", async () => {
  const pages = [
    "index.html", "ride-flow.html", "ride-chat.html", "driver.html", "settings.html",
    "restaurant-register.html", "restaurant-dashboard.html", "restaurant-admin.html",
    "vasi-admin.html", "pricing-admin.html", "partner-admin.html", "support-admin.html",
  ];
  for (const page of pages) {
    const source = await readFile(page, "utf8");
    assert.match(source, /vasi-languages\.js/, `${page} must load the language runtime`);
  }
});

test("legacy public pages redirect to the current product", async () => {
  const redirects = {
    "vasi-clean-start.html": "index.html",
    "vasi-flow.html": "index.html",
    "vasi-new.html": "index.html",
    "vasi-rich.html": "index.html",
    "vasi-ui.html": "index.html",
    "vasi.html": "index.html",
    "driver-app.html": "driver.html",
    "partner-register.html": "partner-register-v2.html",
    "admin/index.html": "../admin-login.html",
  };
  for (const [file, target] of Object.entries(redirects)) {
    const source = await readFile(file, "utf8");
    assert.match(source, new RegExp(`location\\.replace\\(["']${target.replaceAll(".", "\\.")}`));
  }
});
