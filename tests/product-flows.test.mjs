import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

process.env.VASI_SUPABASE_URL = "https://unit-test.supabase.co";
process.env.VASI_SUPABASE_ANON_KEY = "test-publishable-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
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
  assert.equal(res.body.pricing.commission_percent, 15);
  assert.equal(
    Number(
      (
        res.body.pricing.driver_amount + res.body.pricing.vasi_commission
      ).toFixed(2),
    ),
    res.body.pricing.estimated_fare,
  );
  assert.equal(
    res.body.pricing.vasi_commission,
    Number(((res.body.pricing.estimated_fare * 15) / 100).toFixed(2)),
  );
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

test("completed card ride captures the frozen 15% VASI commission", async () => {
  let captureBody = "";
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("/rest/v1/rides?")) {
      return response([{
        id: "ride-card",
        customer_id: "customer-1",
        driver_id: "driver-1",
        status: "completed",
        estimated_fare: 18.4,
        final_fare: 18.4,
        commission_percent: 15,
        vasi_commission: 2.76,
        payment_method: "card",
      }]);
    }
    if (value.endsWith("/auth/v1/user")) return response({ id: "driver-user" });
    if (value.includes("/rest/v1/drivers?")) return response([{ id: "driver-1" }]);
    if (value.includes("/rest/v1/payments?") && options.method !== "PATCH") {
      return response([{ id: "payment-1", provider_payment_id: "pi_test", amount: 18.4 }]);
    }
    if (value.endsWith("/payment_intents/pi_test")) {
      return response({ id: "pi_test", status: "requires_capture", amount: 1840 });
    }
    if (value.includes("/rpc/reserve_ride_cash_commission_offset")) {
      return response({ ok: true, amount: 0, currency: "EUR", status: "none" });
    }
    if (value.endsWith("/payment_intents/pi_test/capture")) {
      captureBody = String(options.body);
      return response({ id: "pi_test", status: "succeeded" });
    }
    if (value.includes("/rest/v1/payments?id=eq.payment-1")) return response(null, 204);
    throw new Error(`Unexpected request: ${value}`);
  };
  const { default: capturePayment } = await import(`../api/capture-payment.js?test=${Date.now()}`);
  const req = { method: "POST", headers: { authorization: "Bearer driver-token" }, body: { ride_id: "ride-card" } };
  const res = mockRes();
  await capturePayment(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(new URLSearchParams(captureBody).get("amount_to_capture"), "1840");
  assert.equal(new URLSearchParams(captureBody).get("application_fee_amount"), "276");
  assert.equal(res.body.commission_percent, 15);
  assert.equal(res.body.vasi_commission, 2.76);
  assert.equal(res.body.driver_amount, 15.64);
  assert.equal(res.body.cash_commission_debt_deducted, 0);
  assert.equal(res.body.bank_payout_credit, 15.64);
});

test("cash commission debt is withheld automatically from the next card ride", async () => {
  let captureBody = "";
  let captureHeaders = {};
  const rpcCalls = [];
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("/rest/v1/rides?")) {
      return response([{
        id: "ride-card-offset",
        customer_id: "customer-1",
        driver_id: "driver-1",
        status: "completed",
        estimated_fare: 20,
        final_fare: 20,
        commission_percent: 15,
        vasi_commission: 3,
        driver_amount: 17,
        payment_method: "card",
      }]);
    }
    if (value.endsWith("/auth/v1/user")) return response({ id: "driver-user" });
    if (value.includes("/rest/v1/drivers?")) return response([{ id: "driver-1" }]);
    if (value.includes("/rest/v1/payments?") && options.method !== "PATCH") {
      return response([{ id: "payment-offset", provider_payment_id: "pi_offset", amount: 20 }]);
    }
    if (value.endsWith("/payment_intents/pi_offset")) {
      return response({ id: "pi_offset", status: "requires_capture", amount: 2000 });
    }
    if (value.includes("/rpc/reserve_ride_cash_commission_offset")) {
      rpcCalls.push("reserve");
      return response({ ok: true, amount: 5, currency: "EUR", status: "reserved" });
    }
    if (value.endsWith("/payment_intents/pi_offset/capture")) {
      captureBody = String(options.body);
      captureHeaders = options.headers;
      return response({ id: "pi_offset", status: "succeeded" });
    }
    if (value.includes("/rest/v1/payments?id=eq.payment-offset")) {
      return response(null, 204);
    }
    throw new Error(`Unexpected request: ${value}`);
  };

  const { default: capturePayment } = await import(
    `../api/capture-payment.js?test=${Date.now()}`
  );
  const req = {
    method: "POST",
    headers: { authorization: "Bearer driver-token" },
    body: { ride_id: "ride-card-offset" },
  };
  const res = mockRes();
  await capturePayment(req, res);

  const capture = new URLSearchParams(captureBody);
  assert.equal(res.statusCode, 200);
  assert.equal(capture.get("amount_to_capture"), "2000");
  assert.equal(capture.get("application_fee_amount"), "800");
  assert.equal(captureHeaders["Idempotency-Key"], "vasi-ride-capture-ride-card-offset");
  assert.deepEqual(rpcCalls, ["reserve"]);
  assert.equal(res.body.vasi_commission, 3);
  assert.equal(res.body.driver_amount, 17);
  assert.equal(res.body.cash_commission_debt_deducted, 5);
  assert.equal(res.body.bank_payout_credit, 12);
  assert.equal(res.body.cash_commission_status, "pending_stripe_confirmation");
});

test("ride commission defaults to 15% and remains admin-adjustable", async () => {
  const [pricingAdmin, pricingApi, adminService, createPayment, migration] = await Promise.all([
    readFile("pricing-admin.html", "utf8"),
    readFile("api/pricing.js", "utf8"),
    readFile("supabase/functions/admin-service/index.ts", "utf8"),
    readFile("api/create-payment-intent.js", "utf8"),
    readFile("supabase/migrations/20260905124034_add_admin_ride_commission.sql", "utf8"),
  ]);
  assert.match(pricingAdmin, /id="ride_commission_percent"/);
  assert.match(pricingAdmin, /value="15"/);
  assert.match(pricingApi, /ride_commission_percent: 15/);
  assert.match(adminService, /Ride commission must be between 0% and 50%/);
  assert.doesNotMatch(createPayment, /PROMO_END|VASI_COMMISSION_PERCENT/);
  assert.match(createPayment, /return 15/);
  assert.match(migration, /ride_commission_percent numeric not null default 15/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /new\.commission_percent := old\.commission_percent/);
  assert.match(migration, /before insert or update of/);
});

test("ride drivers onboard their RIB with weekly Monday automatic payouts", async () => {
  let payoutBody = "";
  let payoutAccount = "";
  let onboardingBody = "";
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith("/auth/v1/user")) return response({ id: "driver-user" });
    if (value.includes("/rest/v1/drivers?")) {
      return response([
        {
          id: "driver-1",
          user_id: "driver-user",
          verified: true,
          stripe_account_id: "acct_driver",
          stripe_details_submitted: true,
          stripe_payouts_enabled: true,
        },
      ]);
    }
    if (value.endsWith("/v1/accounts/acct_driver")) {
      return response({
        id: "acct_driver",
        details_submitted: true,
        payouts_enabled: true,
        metadata: { vasi_driver_id: "driver-1" },
      });
    }
    if (value.endsWith("/v1/balance_settings")) {
      payoutBody = String(options.body);
      payoutAccount = options.headers["Stripe-Account"];
      return response({
        payments: {
          payouts: {
            schedule: {
              interval: "weekly",
              weekly_payout_days: ["monday"],
            },
          },
        },
      });
    }
    if (value.endsWith("/v1/account_links")) {
      onboardingBody = String(options.body);
      return response({ url: "https://connect.stripe.test/onboarding" });
    }
    throw new Error(`Unexpected request: ${value}`);
  };

  const { default: onboardDriver } = await import(
    `../api/driver-stripe-onboarding.js?test=${Date.now()}`
  );
  const req = {
    method: "POST",
    headers: { authorization: "Bearer driver-token" },
    body: { country: "FR" },
  };
  const res = mockRes();
  await onboardDriver(req, res);

  const payout = new URLSearchParams(payoutBody);
  const onboarding = new URLSearchParams(onboardingBody);
  assert.equal(res.statusCode, 200);
  assert.equal(payoutAccount, "acct_driver");
  assert.equal(
    payout.get("payments[payouts][schedule][interval]"),
    "weekly",
  );
  assert.deepEqual(
    payout.getAll("payments[payouts][schedule][weekly_payout_days][]"),
    ["monday"],
  );
  assert.equal(
    onboarding.get("return_url"),
    "https://vasi-new.vercel.app/driver.html?stripe=complete",
  );
  assert.deepEqual(res.body.payout_schedule, {
    interval: "weekly",
    day: "monday",
  });

  const driverPage = await readFile("driver.html", "utf8");
  assert.match(driverPage, /Connect bank account \(RIB\)/);
  assert.match(driverPage, /automatically to your RIB every Monday/);
  assert.match(driverPage, /\/api\/driver-stripe-onboarding/);
  assert.match(driverPage, /get_driver_cash_commission_balance/);
  assert.match(driverPage, /deduct automatically from future card earnings/);
});

test("restaurant owners connect their own RIB with weekly Monday payouts", async () => {
  let accountBody = "";
  let payoutBody = "";
  let payoutAccount = "";
  let onboardingBody = "";
  const servicePatches = [];
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.endsWith("/auth/v1/user"))
      return response({ id: "owner-1" });
    if (value.includes("/rest/v1/restaurants?") && options.method !== "PATCH") {
      return response([{
        id: "restaurant-1",
        owner_id: "owner-1",
        name: "VASI Test Kitchen",
        legal_name: "VASI Test Kitchen SAS",
        email: "owner@example.test",
        phone: "+33600000000",
        status: "approved",
        stripe_account_id: null,
        stripe_details_submitted: false,
        stripe_payouts_enabled: false,
      }]);
    }
    if (value.includes("/rest/v1/restaurants?id=eq.restaurant-1") && options.method === "PATCH") {
      servicePatches.push(JSON.parse(options.body));
      return response([{}]);
    }
    if (value.endsWith("/v1/accounts")) {
      accountBody = String(options.body);
      return response({ id: "acct_restaurant", details_submitted: false, payouts_enabled: false });
    }
    if (value.endsWith("/v1/balance_settings")) {
      payoutBody = String(options.body);
      payoutAccount = options.headers["Stripe-Account"];
      return response({});
    }
    if (value.endsWith("/v1/account_links")) {
      onboardingBody = String(options.body);
      return response({ url: "https://connect.stripe.test/restaurant" });
    }
    throw new Error(`Unexpected request: ${value}`);
  };

  const { default: onboardRestaurant } = await import(
    `../api/restaurant-stripe-onboarding.js?test=${Date.now()}`
  );
  const res = mockRes();
  await onboardRestaurant({
    method: "POST",
    headers: { authorization: "Bearer owner-token" },
    body: {},
  }, res);

  const account = new URLSearchParams(accountBody);
  const payout = new URLSearchParams(payoutBody);
  const onboarding = new URLSearchParams(onboardingBody);
  assert.equal(res.statusCode, 200);
  assert.equal(account.get("capabilities[transfers][requested]"), "true");
  assert.equal(account.get("metadata[vasi_restaurant_id]"), "restaurant-1");
  assert.equal(account.get("metadata[vasi_user_id]"), "owner-1");
  assert.equal(payoutAccount, "acct_restaurant");
  assert.equal(payout.get("payments[payouts][schedule][interval]"), "weekly");
  assert.deepEqual(payout.getAll("payments[payouts][schedule][weekly_payout_days][]"), ["monday"]);
  assert.equal(onboarding.get("return_url"), "https://vasi-new.vercel.app/restaurant-dashboard.html?stripe=complete");
  assert.equal(servicePatches[0].stripe_account_id, "acct_restaurant");
  assert.deepEqual(res.body.payout_schedule, { interval: "weekly", day: "monday" });
});

test("all paid provider roles require a verified RIB and restaurants receive idempotent transfers", async () => {
  const [migration, dashboard, partnerApi, courierService, providerPayout, webhook, driverOnboarding, restaurantOnboarding, vercel] = await Promise.all([
    readFile("supabase/migrations/20260906023000_add_provider_stripe_payout_readiness.sql", "utf8"),
    readFile("restaurant-dashboard.html", "utf8"),
    readFile("api/restaurant-partner.js", "utf8"),
    readFile("supabase/functions/delivery-driver-service/index.ts", "utf8"),
    readFile("supabase/functions/provider-payout-service/index.ts", "utf8"),
    readFile("supabase/functions/stripe-webhook/index.ts", "utf8"),
    readFile("api/driver-stripe-onboarding.js", "utf8"),
    readFile("api/restaurant-stripe-onboarding.js", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);
  assert.match(migration, /stripe_payouts_enabled = true/);
  assert.match(migration, /vasi_restaurant_toggle_open/);
  assert.match(migration, /vasi_restaurant_complete_own_delivery/);
  assert.match(migration, /delivery_pin/);
  assert.match(dashboard, /\/api\/restaurant-stripe-onboarding/);
  assert.match(dashboard, /Complete delivery · enter PIN/);
  assert.match(partnerApi, /idempotencyKey: `vasi-eats-restaurant-/);
  assert.match(partnerApi, /source_transaction/);
  assert.match(partnerApi, /provider-payout-service/);
  assert.match(courierService, /releaseEatsRestaurantPayout/);
  assert.match(providerPayout, /driver_onboarding/);
  assert.match(providerPayout, /restaurant_onboarding/);
  assert.match(providerPayout, /restaurant_complete_own_delivery/);
  assert.match(providerPayout, /idempotencyKey: `vasi-eats-restaurant-/);
  assert.match(providerPayout, /source_transaction/);
  assert.match(webhook, /vasi_restaurant_id/);
  assert.match(driverOnboarding, /provider-payout-service/);
  assert.match(restaurantOnboarding, /provider-payout-service/);
  assert.match(vercel, /api\/restaurant-stripe-onboarding\.js/);
});

test("cash ride commission ledger is private, idempotent and card-offset aware", async () => {
  const migration = await readFile(
    "supabase/migrations/20260905143000_add_ride_cash_commission_offsets.sql",
    "utf8",
  );
  assert.match(migration, /driver_cash_commission_debts/);
  assert.match(migration, /unique references public\.rides/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /reserve_ride_cash_commission_offset/);
  assert.match(migration, /apply_ride_cash_commission_offset/);
  assert.match(migration, /release_ride_cash_commission_offset/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /grant execute.*to authenticated/s);
});

test("only the Stripe-signed webhook finalizes or releases cash debt offsets", async () => {
  const [capture, intent, webhook] = await Promise.all([
    readFile("api/capture-payment.js", "utf8"),
    readFile("api/create-payment-intent.js", "utf8"),
    readFile("supabase/functions/stripe-webhook/index.ts", "utf8"),
  ]);
  assert.doesNotMatch(capture, /apply_ride_cash_commission_offset/);
  assert.doesNotMatch(capture, /release_ride_cash_commission_offset/);
  assert.match(intent, /metadata\[service\].*ride/);
  assert.match(webhook, /payment_intent\.succeeded/);
  assert.match(webhook, /apply_ride_cash_commission_offset/);
  assert.match(webhook, /payment_intent\.canceled/);
  assert.match(webhook, /release_ride_cash_commission_offset/);
});

test("VASI Eats prices a paid order and protects the courier earning", async () => {
  let insertedOrder = null;
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("/rest/v1/restaurants?")) {
      return response([{ id: "restaurant-1", name: "VASI Test Kitchen", cuisine: "French", preparation_minutes: 20, minimum_order: 8, delivery_fee: 2.5, delivery_mode: "vasi", delivery_radius_km: 8, commission_rate: 0.1, address: "10 Rue de Paris", city: "Creil", postal_code: "60100" }]);
    }
    if (value.includes("/rest/v1/restaurant_menu_items?")) {
      return response([{ id: "item-1", restaurant_id: "restaurant-1", name: "Meal", category: "Menu", price: 10, allergens: [] }]);
    }
    if (value.endsWith("/auth/v1/user")) return response({ id: "customer-1" });
    if (value.includes("nominatim.openstreetmap.org")) return response([{ display_name: "1 Rue de Paris, 60100 Creil", lat: "49.2583", lon: "2.4829" }]);
    if (value.includes("router.project-osrm.org")) return response({ routes: [{ distance: 3_000, duration: 600 }] });
    if (value.endsWith("/rest/v1/eats_orders") && options.method === "POST") {
      insertedOrder = JSON.parse(options.body);
      return response([{ id: "order-123" }], 201);
    }
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
  assert.equal(res.body.payment_required, true);
  assert.equal(res.body.courier_offer_amount, 7.35);
  assert.equal(res.body.service_fee, 1);
  assert.equal(res.body.total, 26.35);
  assert.equal(res.body.commission_rate, 0.1);
  assert.equal(res.body.restaurant_commission, 2);
  assert.equal(res.body.restaurant_net, 18);
  assert.equal(insertedOrder.status, "awaiting_payment");
  assert.equal(insertedOrder.payment_status, "unpaid");
  assert.equal(insertedOrder.courier_offer_amount, 7.35);
});

test("Eats courier pricing is always at least €4 and €20 per estimated active hour", async () => {
  const { calculateEatsPricing } = await import(`../api/eats-pricing.js?test=${Date.now()}`);
  const shortJob = calculateEatsPricing({ subtotal: 10, distanceKm: 0.5, routeMinutes: 2 });
  assert.equal(shortJob.courierOfferAmount, 4);
  const longJob = calculateEatsPricing({ subtotal: 30, distanceKm: 1, routeMinutes: 52 });
  assert.ok(longJob.courierOfferAmount >= 20);
});

test("Eats checkout and courier app enforce payment then PIN-gated RIB payout", async () => {
  const [checkout, courier, service, migration] = await Promise.all([
    readFile("eats-checkout.html", "utf8"),
    readFile("delivery-driver.html", "utf8"),
    readFile("supabase/functions/delivery-driver-service/index.ts", "utf8"),
    readFile("supabase/migrations/20260905000000_add_eats_courier_payouts.sql", "utf8"),
  ]);
  assert.match(checkout, /js\.stripe\.com\/v3/);
  assert.match(checkout, /eats-payment/);
  assert.match(checkout, /Continue to secure payment/);
  assert.match(courier, /Connect bank account \(RIB\)/);
  assert.match(courier, /create_payout_onboarding/);
  assert.match(courier, /paid automatically every Monday/);
  assert.match(courier, /minimum €4 per delivery and €20\/hour/);
  assert.match(service, /\/v1\/balance_settings/);
  assert.match(service, /weekly_payout_days/);
  assert.match(service, /"monday"/);
  assert.match(service, /source_transaction/);
  assert.match(service, /idempotencyKey: `vasi-eats-courier-/);
  assert.match(service, /vasi_courier_complete_eats_order/);
  assert.match(migration, /payment_status text/);
  assert.match(migration, /courier_eats_earnings/);
});

test("restaurant commission is a permanent 10% for every delivery mode", async () => {
  const [register, dashboard, classicAdmin, adminApp, migration, enforcement] = await Promise.all([
    readFile("restaurant-register.html", "utf8"),
    readFile("restaurant-dashboard.html", "utf8"),
    readFile("restaurant-admin.html", "utf8"),
    readFile("admin/app.js", "utf8"),
    readFile("supabase/migrations/20260904231000_set_restaurant_commission_to_ten_percent.sql", "utf8"),
    readFile("supabase/migrations/20260904231500_enforce_eats_commission_math.sql", "utf8"),
  ]);
  assert.match(register, /Commission restaurant simple · 10 %/);
  assert.match(register, /Ma propre équipe · 10 %/);
  assert.doesNotMatch(register, /3 premiers mois|5 % avec/);
  assert.doesNotMatch(dashboard, /launch commission until/);
  assert.match(classicAdmin, /commission_rate:\.10/);
  assert.match(adminApp, /commission_rate:\.10/);
  assert.match(migration, /commission_rate = 0\.10/);
  assert.match(migration, /restaurant_commission = round\(subtotal \* 0\.10, 2\)/);
  assert.match(enforcement, /before insert or update of subtotal/);
  assert.match(enforcement, /security invoker/);
  assert.match(enforcement, /new\.restaurant_commission := round\(new\.subtotal \* 0\.10, 2\)/);
});

test("Eats surfaces expose competitor-grade ordering, tracking and operations essentials", async () => {
  const [eats, activity, restaurant, courier] = await Promise.all([
    readFile("eats.html", "utf8"),
    readFile("activity.html", "utf8"),
    readFile("restaurant-dashboard.html", "utf8"),
    readFile("delivery-driver.html", "utf8"),
  ]);

  assert.match(eats, /Cuisine filters/);
  assert.match(eats, /t\('Allergens'\)/);
  assert.match(eats, /View basket/);
  assert.match(eats, /activity\.html\?filter=eats/);
  assert.match(activity, /Order progress/);
  assert.match(activity, /Courier is on the way/);
  assert.match(restaurant, /Restaurant performance/);
  assert.match(restaurant, /Active orders/);
  assert.match(restaurant, /nextOrderAction/);
  assert.match(courier, /google\.com\/maps\/dir/);
  assert.match(courier, /Navigate to customer/);
  assert.match(courier, /Navigate to pickup/);
});

test("public surfaces distinguish an empty catalog and ship consistent localization and browser protections", async () => {
  const [eats, delivery, auth, languages, vercel] = await Promise.all([
    readFile("eats.html", "utf8"),
    readFile("delivery.html", "utf8"),
    readFile("auth.html", "utf8"),
    readFile("vasi-languages.js", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);

  assert.match(eats, /catalog\.length/);
  assert.match(eats, /No restaurants are available yet\./);
  assert.match(eats, /Approved partners will appear here/);
  assert.match(delivery, /Get a new quote for the parcel\./);
  assert.match(auth, /t\(customer \? "Customer login"/);
  assert.doesNotMatch(auth, /\$\("title"\)\.textContent = customer \? "Connexion client"/);
  assert.match(languages, /Aucun restaurant n’est encore disponible\./);
  assert.match(languages, /இன்னும் எந்த உணவகமும் கிடைக்கவில்லை\./);
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /Permissions-Policy/);
  const serviceWorker = await readFile("sw.js", "utf8");
  assert.match(serviceWorker, /vasi-app-v28/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /new Request\(url, \{ cache: "reload" \}\)/);
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

test("account surfaces reflow safely on narrow phones", async () => {
  const [account, settings] = await Promise.all([
    readFile("account.html", "utf8"),
    readFile("settings.html", "utf8"),
  ]);

  for (const page of [account, settings]) {
    assert.match(page, /@media \(max-width: 360px\)/);
    assert.match(page, /overflow-x:\s*clip/);
    assert.match(page, /-webkit-text-size-adjust:\s*100%/);
    assert.match(page, /\.app\s*\{[\s\S]*?max-width:\s*100%/);
  }

  assert.match(
    account,
    /\.section-head\.address-heading\s*\{[\s\S]*?flex-wrap:\s*wrap/,
  );
  assert.match(
    account,
    /\.account-actions\s*\{[\s\S]*?flex-wrap:\s*wrap/,
  );
  assert.match(
    settings,
    /\.required\s*\{[\s\S]*?overflow-wrap:\s*anywhere/,
  );
  assert.match(settings, /select\s*\{\s*max-width:\s*112px/);
});

test("restaurant join and dashboard use restaurant authentication", async () => {
  const [register, dashboard, auth] = await Promise.all([
    readFile("restaurant-register.html", "utf8"),
    readFile("restaurant-dashboard.html", "utf8"),
    readFile("auth.html", "utf8"),
  ]);
  assert.match(register, /Créer mon compte restaurant/);
  assert.match(register, /localStorage\.setItem\("vasi_role", "restaurant"\)/);
  assert.match(register, /emailRedirectTo: new URL\("restaurant-register\.html"/);
  assert.match(register, /shouldCreateUser: true/);
  assert.match(register, /Continuer avec mon numéro de téléphone/);
  assert.match(register, /auth\.html\?role=restaurant&method=phone/);
  assert.match(register, /service e-mail est momentanément indisponible/);
  assert.match(register, /id="restaurantPanel" class="panel hidden"/);
  assert.match(auth, /const requestedMethod = searchParams\.get\("method"\)/);
  assert.match(auth, /const usesPhone = \(\) => authMethod === "phone"/);
  assert.match(auth, /localStorage\.setItem\("vasi_role", role\)/);
  assert.match(dashboard, /localStorage\.setItem\('vasi_role','restaurant'\)/);
  assert.match(dashboard, /auth\.html\?role=restaurant/);
  assert.doesNotMatch(
    dashboard,
    /localStorage\.setItem\('vasi_role','customer'\).*auth\.html\?role=customer/,
  );
  assert.match(auth, /savedRole === "restaurant"/);
  assert.match(auth, /back === "restaurant-register\.html"/);
  assert.match(auth, /return "restaurant-dashboard\.html"/);
});

test("customer login offers phone OTP and email magic-link choices", async () => {
  const auth = await readFile("auth.html", "utf8");
  assert.match(auth, /id="methodSwitch"/);
  assert.match(auth, /id="phoneMethodBtn"/);
  assert.match(auth, /id="emailMethodBtn"/);
  assert.match(auth, /Continue with email/);
  const languages = await readFile("vasi-languages.js", "utf8");
  assert.match(languages, /"Continue with email": "Continuer avec mon e-mail"/);
  assert.match(auth, /authMethod === "phone"/);
  assert.match(auth, /role !== "customer"/);
  assert.match(auth, /emailRedirectTo:[\s\S]*&method=email/);
  assert.match(auth, /service e-mail est momentanément indisponible/);
});

test("restaurant food photos are optional, owner-scoped and safely reviewed", async () => {
  const [dashboard, migration, adminApp, adminService] = await Promise.all([
    readFile("restaurant-dashboard.html", "utf8"),
    readFile(
      "supabase/migrations/20260904222000_add_ai_menu_photo_review.sql",
      "utf8",
    ),
    readFile("admin/app.js", "utf8"),
    readFile("supabase/functions/admin-service/index.ts", "utf8"),
  ]);
  assert.match(dashboard, /Food photos are optional/);
  assert.match(dashboard, /action:'submit_photo'/);
  assert.match(dashboard, /image\/jpeg,image\/png,image\/webp/);
  assert.match(dashboard, /Photo approved and published/);
  assert.match(migration, /'restaurant-menu-photos'/);
  assert.match(migration, /file_size_limit/);
  assert.match(migration, /photo_status in \('none','checking','approved','needs_changes','admin_review'\)/);
  assert.match(
    migration,
    /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/,
  );
  assert.match(migration, /Restaurant owners can never self-approve/);
  assert.match(adminApp, /data-photo-decision="approved"/);
  assert.match(adminService, /action === 'review_menu_photo'/);
  assert.match(adminService, /photo_reviewed_by: user\.id/);
});

test("menu photo AI approval falls back to admin review without a server database key", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  delete process.env.VASI_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const value = String(url);
    calls.push({ url: value, options });
    if (value.endsWith("/auth/v1/user")) return response({ id: "owner-1" });
    if (value.includes("/rest/v1/restaurants?"))
      return response([{ id: "restaurant-1", owner_id: "owner-1" }]);
    if (value.includes("/rest/v1/restaurant_menu_items?select=id,name"))
      return response([
        {
          id: "item-1",
          restaurant_id: "restaurant-1",
          name: "Vegetable curry",
          description: "Fresh curry",
          category: "Main",
        },
      ]);
    if (value.includes("/storage/v1/object/restaurant-menu-photos/"))
      return response({ Key: "uploaded" });
    if (value.includes("/rest/v1/rpc/vasi_restaurant_set_menu_photo_pending"))
      return response({ id: "item-1", photo_status: "checking" });
    if (value === "https://api.openai.com/v1/responses")
      return response({
        output_text: JSON.stringify({
          decision: "approved",
          confidence: 0.96,
          reason: "Clear food photo matching the menu item.",
        }),
      });
    if (value.includes("/rest/v1/rpc/vasi_restaurant_finish_menu_photo_review"))
      return response({ id: "item-1", photo_status: "admin_review" });
    throw new Error(`Unexpected request: ${value}`);
  };

  const { default: restaurantPartner } = await import(
    `../api/restaurant-partner.js?photo=${Date.now()}`
  );
  const res = mockRes();
  await restaurantPartner(
    {
      method: "POST",
      headers: { authorization: "Bearer restaurant-token" },
      body: {
        action: "submit_photo",
        id: "item-1",
        image: `data:image/png;base64,${Buffer.from("food-photo").toString("base64")}`,
      },
    },
    res,
  );
  delete process.env.OPENAI_API_KEY;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.item.photo_status, "admin_review");
  const aiCall = calls.find((call) => call.url === "https://api.openai.com/v1/responses");
  assert.ok(aiCall);
  const aiBody = JSON.parse(aiCall.options.body);
  assert.equal(aiBody.text.format.type, "json_schema");
  assert.ok(aiBody.input[0].content.some((part) => part.type === "input_image"));
  const fallbackCall = calls.find((call) =>
    call.url.includes("vasi_restaurant_finish_menu_photo_review"),
  );
  assert.equal(JSON.parse(fallbackCall.options.body).p_status, "admin_review");
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

test("shared language runtime translates English and French source pages both ways", async () => {
  const source = await readFile("vasi-languages.js", "utf8");
  const runtime = (selectedLanguage) => {
    const window = { dispatchEvent() {} };
    runInNewContext(source, {
      window,
      document: { readyState: "loading", addEventListener() {} },
      localStorage: { getItem: () => selectedLanguage, setItem() {} },
      CustomEvent: class {},
    });
    return window.VasiLanguage;
  };

  const french = runtime("fr");
  assert.equal(french.translate("Book a ride"), "Commander un trajet");
  assert.equal(french.translate("🚗 Ride"), "🚗 Trajet");
  assert.equal(french.translate("Fast city trips"), "Trajets en ville");
  assert.equal(french.translate("Food delivery"), "Repas livrés");
  assert.equal(french.translate("Send anything"), "Envoyez un colis");
  assert.equal(french.translate("Legal & Privacy"), "Juridique & confidentialité");
  assert.equal(french.translate("Account →"), "Compte →");
  assert.equal(french.translate("🗓️ Custom date & time"), "🗓️ Date et heure personnalisées");

  const english = runtime("en");
  assert.equal(english.translate("Commander un trajet"), "Book a ride");
  assert.equal(english.translate("← Retour"), "← Back");
  assert.equal(english.translate("Envoyez vos colis."), "Send anything.");
  assert.equal(english.translate("(facultatif)"), "(optional)");
  assert.equal(
    english.translate("Créez un seul compte pour conduire des passagers ou effectuer des livraisons."),
    "Create one account to drive passengers or make deliveries.",
  );
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

test("bicycle couriers are not asked for motor-vehicle licence documents", async () => {
  const registration = await readFile("partner-register-v2.html", "utf8");
  assert.doesNotMatch(registration, /\.page-nav\{position:sticky/);
  assert.match(registration, /\.page-nav\{display:flex/);
  assert.match(registration, /Aucun permis de conduire requis/);
  assert.match(registration, /const motorVehicles = new Set\(\['scooter', 'moto', 'car'\]\)/);
  assert.match(registration, /const cycle = role === 'courier' && !motor/);
  assert.match(registration, /\$\('motorDocs'\)\.classList\.toggle\('hidden', !motor\)/);
  assert.match(registration, /identity:selected\('identity'\), business:selected\('courier_business'\), bag:selected\('bag'\), vehicle_photo:selected\('vehicle_photo'\)/);
  assert.doesNotMatch(registration, /id="rib"/);
  assert.match(registration, /Vous ajoutez vous-même votre RIB/);
  assert.match(registration, /VASI ne stocke pas votre IBAN complet/);
  assert.match(registration, /if \(motorVehicles\.has\(vehicle\)\) Object\.assign\(files/);
  assert.match(registration, /Photo de profil <span class="optional">Facultatif<\/span>/);
});

test("courier approval validates documents and protects review fields", async () => {
  const [adminService, migration] = await Promise.all([
    readFile("supabase/functions/admin-service/index.ts", "utf8"),
    readFile("supabase/migrations/20260904234000_secure_courier_document_review.sql", "utf8"),
  ]);
  assert.match(adminService, /function courierRequiredDocuments/);
  assert.doesNotMatch(adminService, /\['identity', 'business', 'rib'/);
  assert.match(adminService, /if \(motorCourierVehicles\.has\(vehicleType\)\)/);
  assert.match(adminService, /Missing required documents/);
  assert.match(adminService, /createSignedUrl\(path, 600\)/);
  assert.match(migration, /new\.verified := old\.verified/);
  assert.match(migration, /request_role <> 'service_role'/);
  assert.match(migration, /application_status in \('pending', 'approved', 'rejected'\)/);
});

test("approved couriers must self-connect a verified RIB before going online", async () => {
  const [courier, service] = await Promise.all([
    readFile("delivery-driver.html", "utf8"),
    readFile("supabase/functions/delivery-driver-service/index.ts", "utf8"),
  ]);
  assert.match(courier, /payoutReady = false/);
  assert.match(courier, /Connect and verify your bank account \(RIB\) before going online/);
  assert.match(service, /!courier\.stripe_account_id \|\| !courier\.stripe_payouts_enabled/);
  assert.match(service, /Connect and verify your bank account \(RIB\) before going online/);
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

test("public account surfaces expose bilingual legal and privacy information", async () => {
  const [legal, index, account, settings, migration] = await Promise.all([
    readFile("legal.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("account.html", "utf8"),
    readFile("settings.html", "utf8"),
    readFile("supabase/migrations/20260905220109_harden_postgis_public_access.sql", "utf8"),
  ]);

  assert.match(legal, /Legal & Privacy/);
  assert.match(legal, /Politique de confidentialité/);
  assert.match(legal, /contact@vasigo\.eu/);
  assert.match(legal, /defaults to 15%/);
  for (const surface of [index, account, settings]) assert.match(surface, /legal\.html/);
  assert.match(migration, /alter table public\.spatial_ref_sys enable row level security/i);
  assert.match(migration, /revoke execute on function public\.st_estimatedextent/i);
});
