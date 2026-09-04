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

test("AI map assistance returns only safe address text and never model coordinates", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let requestBody;
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/auth/v1/user"))
      return response({ id: "customer-1" });
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    requestBody = JSON.parse(options.body);
    return response({
      output_text: JSON.stringify({
        suggestions: [
          "Gare du Nord, Paris, France",
          "48.8809, 2.3553",
          "https://example.com/place",
        ],
      }),
    });
  };
  const { default: aiMapAssist } = await import(
    `../api/ai-map-assist.js?test=${Date.now()}`
  );
  const res = mockRes();
  await aiMapAssist(
    {
      method: "POST",
      headers: { authorization: "Bearer customer-token" },
      body: { query: "gar du nor pari", kind: "destination" },
    },
    res,
  );
  delete process.env.OPENAI_API_KEY;
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.suggestions, ["Gare du Nord, Paris, France"]);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.match(requestBody.instructions, /Never invent/);
  assert.match(requestBody.instructions, /coordinates/);
});

test("AI map assistance degrades safely when no API key is configured", async () => {
  delete process.env.OPENAI_API_KEY;
  global.fetch = async (url) => {
    if (String(url).endsWith("/auth/v1/user"))
      return response({ id: "customer-1" });
    throw new Error("OpenAI must not be called without a server key");
  };
  const { default: aiMapAssist } = await import(
    `../api/ai-map-assist.js?fallback=${Date.now()}`
  );
  const res = mockRes();
  await aiMapAssist(
    {
      method: "POST",
      headers: { authorization: "Bearer customer-token" },
      body: { query: "Creil station", kind: "pickup" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { enabled: false, suggestions: [] });
});

test("Google Places returns lean autocomplete suggestions and resolves the selected pin", async () => {
  process.env.GOOGLE_MAPS_SERVER_KEY = "google-test-key";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("places.googleapis.com")) {
      return response({
        suggestions: [
          {
            placePrediction: {
              placeId: "ChIJVasiTestPlace123",
              text: { text: "Gare du Nord, Paris, France" },
              structuredFormat: {
                mainText: { text: "Gare du Nord" },
                secondaryText: { text: "Paris, France" },
              },
            },
          },
        ],
      });
    }
    if (String(url).includes("maps.googleapis.com/maps/api/geocode")) {
      return response({
        results: [
          {
            place_id: "ChIJVasiTestPlace123",
            formatted_address: "Gare du Nord, 75010 Paris, France",
            geometry: { location: { lat: 48.8809, lng: 2.3553 } },
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const { default: places } = await import(`../api/places.js?test=${Date.now()}`);
  const suggestionRes = mockRes();
  await places(
    {
      method: "POST",
      headers: { origin: "https://nantha010789-collab.github.io" },
      body: {
        action: "autocomplete",
        input: "gare du nor",
        location: { lat: 48.8566, lng: 2.3522 },
      },
    },
    suggestionRes,
  );
  assert.equal(suggestionRes.statusCode, 200);
  assert.equal(suggestionRes.body.suggestions[0].main, "Gare du Nord");
  assert.equal(
    suggestionRes.headers["access-control-allow-origin"],
    "https://nantha010789-collab.github.io",
  );
  const placesCall = calls.find((item) => item.url.includes("places.googleapis.com"));
  assert.match(placesCall.options.headers["X-Goog-FieldMask"], /placeId/);
  assert.deepEqual(JSON.parse(placesCall.options.body).includedRegionCodes.slice(0, 2), ["fr", "gb"]);

  const resolveRes = mockRes();
  await places(
    {
      method: "POST",
      headers: {},
      body: { action: "resolve", place_id: "ChIJVasiTestPlace123" },
    },
    resolveRes,
  );
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  assert.equal(resolveRes.statusCode, 200);
  assert.deepEqual(resolveRes.body.place, {
    place_id: "ChIJVasiTestPlace123",
    label: "Gare du Nord, 75010 Paris, France",
    lat: 48.8809,
    lng: 2.3553,
  });
});

test("ride map verifies AI address text with the trusted geocoder", async () => {
  const source = await readFile("ride-flow.html", "utf8");
  assert.match(source, /apiUrl\("\/api\/ai-map-assist"\)/);
  assert.match(source, /AI supplies text only/);
  assert.match(source, /await geocodeDestination\(query\)/);
  assert.match(source, /AI corrected your \$\{kind\} address/);
});

test("ride map uses debounced Google suggestions and requires pin confirmation", async () => {
  const source = await readFile("ride-flow.html", "utf8");
  assert.match(source, /schedulePlaceSuggestions/);
  assert.match(source, /apiUrl\("\/api\/places"\)/);
  assert.match(source, /setTimeout\(loadPlaceSuggestions, 420\)/);
  assert.match(source, /L\.marker\(p, \{ draggable: true \}\)/);
  assert.match(source, /function confirmDestination\(\)/);
  assert.match(source, /destination && destinationConfirmed/);
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
  assert.match(auth, /const RESEND_WAIT_SECONDS = 90/);
  assert.match(auth, /Every earlier code is now invalid/);
  assert.match(auth, /persistSession: true/);
  for (const language of ["fr", "en", "ta", "de", "ar", "hi"]) assert.match(languages, new RegExp(`\\b${language}:`));
});

test("customer profile photo remains optional and owner-scoped", async () => {
  const [account, migration] = await Promise.all([
    readFile("account.html", "utf8"),
    readFile(
      "supabase/migrations/20260904182500_add_optional_customer_avatar.sql",
      "utf8",
    ),
  ]);
  assert.match(account, /id="avatarButton"/);
  assert.match(account, /id="removeAvatarButton"/);
  assert.match(account, /Optional · JPG, PNG or WebP · max 2 MB/);
  assert.match(account, /createSignedUrl\(path, 60 \* 60\)/);
  assert.match(account, /upsert: true/);
  assert.match(account, /el\("avatarInitials"\)\.textContent = initials\(name\)/);
  assert.match(migration, /'customer-avatars'/);
  assert.match(migration, /file_size_limit/);
  assert.match(migration, /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  assert.match(migration, /for delete\s+to authenticated/);
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
  };
  for (const [file, target] of Object.entries(redirects)) {
    const source = await readFile(file, "utf8");
    assert.match(source, new RegExp(`location\\.replace\\(["']${target.replaceAll(".", "\\.")}`));
  }
});

test("PWA install metadata and baseline security headers stay production-ready", async () => {
  const [index, manifestSource, worker, vercel, icon192, icon512] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("manifest.webmanifest", "utf8"),
    readFile("sw.js", "utf8"),
    readFile("vercel.json", "utf8"),
    readFile("vasi-icon-192.png"),
    readFile("vasi-icon-512.png"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const headers = JSON.parse(vercel).headers[0].headers;
  const header = (name) => headers.find((item) => item.key === name)?.value;

  assert.match(index, /rel="apple-touch-icon" href="\.\/vasi-icon-192\.png"/);
  assert.match(index, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.equal(manifest.theme_color, "#050505");
  assert.equal(manifest.background_color, "#050505");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.ok(icon192.length > 1_000);
  assert.ok(icon512.length > 1_000);
  assert.match(worker, /vasi-icon-192\.png/);
  assert.match(worker, /vasi-icon-512\.png/);
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("X-Frame-Options"), "DENY");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
});
