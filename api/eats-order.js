import { calculateEatsPricing, VASI_COURIER_RATES } from "./eats-pricing.js";

const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publicKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const publicHeaders = () => ({ apikey: publicKey, Authorization: `Bearer ${publicKey}` });

async function db(path, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...publicHeaders(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Database request failed");
  return data;
}

async function adminDb(path, options = {}) {
  if (!serviceKey) throw new Error("Eats order service is not configured");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Database request failed");
  return data;
}

async function catalog() {
  if (!publicKey) throw new Error("Restaurant service is not configured");
  const restaurants = await db(
    "restaurants?select=id,name,cuisine,preparation_minutes,minimum_order,delivery_fee,delivery_mode,delivery_radius_km,commission_rate,address,city,postal_code&status=eq.approved&active=eq.true&is_open=eq.true&order=name.asc",
  );
  if (!restaurants.length) return [];
  const items = await db(
    `restaurant_menu_items?select=id,restaurant_id,name,description,category,price,allergens,photo_url&active=eq.true&restaurant_id=in.(${restaurants.map((item) => item.id).join(",")})&order=sort_order.asc,name.asc`,
  );
  return restaurants
    .map((restaurant) => ({
      ...restaurant,
      icon: "🍽️",
      eta: `${restaurant.preparation_minutes}–${restaurant.preparation_minutes + 10} min`,
      items: items
        .filter((item) => item.restaurant_id === restaurant.id)
        .map((item) => ({ ...item, price: Number(item.price) })),
    }))
    .filter((restaurant) => restaurant.items.length);
}

function cleanAddress(value) {
  const address = String(value || "").trim().slice(0, 200);
  if (address.length < 6) throw new Error("Enter a valid full delivery address");
  return address;
}

async function geocode(value) {
  const query = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "fr,gb,be,de,nl,lu,ch,es,it,pt",
    q: cleanAddress(value),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: { "User-Agent": "VASI/1.0 (eats-delivery-pricing)" },
  });
  if (!response.ok) throw new Error("Address search is temporarily unavailable");
  const result = (await response.json())?.[0];
  const lat = Number(result?.lat);
  const lng = Number(result?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw new Error("Delivery address not found");
  return { lat, lng, address: result.display_name || value };
}

async function deliveryRoute(restaurant, deliveryAddress) {
  const restaurantAddress = [restaurant.address, restaurant.postal_code, restaurant.city]
    .filter(Boolean)
    .join(", ");
  const [pickup, dropoff] = await Promise.all([
    geocode(restaurantAddress),
    geocode(deliveryAddress),
  ]);
  const coordinates = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`,
    { headers: { "User-Agent": "VASI/1.0 (eats-delivery-pricing)" } },
  );
  if (!response.ok) throw new Error("Delivery route service is unavailable");
  const route = (await response.json())?.routes?.[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration))
    throw new Error("No delivery route was found for this address");
  const distanceKm = route.distance / 1000;
  const radiusKm = Math.max(1, Number(restaurant.delivery_radius_km) || 5);
  if (distanceKm > radiusKm)
    throw new Error(`This address is outside the restaurant's ${radiusKm} km delivery area`);
  return {
    deliveryAddress: dropoff.address,
    distanceKm,
    routeMinutes: Math.max(1, Math.ceil(route.duration / 60)),
  };
}

async function price(body) {
  const restaurant = (await catalog()).find(
    (item) => item.id === String(body.restaurant_id || ""),
  );
  if (!restaurant) throw new Error("Restaurant is closed or unavailable");
  const requested = Array.isArray(body.items) ? body.items : [];
  if (!requested.length || requested.length > 20)
    throw new Error("Choose at least one valid item");
  const items = requested.map((entry) => {
    const menuItem = restaurant.items.find((item) => item.id === String(entry.id || ""));
    const quantity = Number(entry.quantity);
    if (!menuItem || !Number.isInteger(quantity) || quantity < 1 || quantity > 10)
      throw new Error("Invalid basket item");
    return {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      line_total: Number((menuItem.price * quantity).toFixed(2)),
    };
  });
  const subtotal = Number(items.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
  if (subtotal < Number(restaurant.minimum_order || 0))
    throw new Error(`Minimum order is €${Number(restaurant.minimum_order).toFixed(2)}`);

  const route = body.delivery_address
    ? await deliveryRoute(restaurant, body.delivery_address)
    : { deliveryAddress: null, distanceKm: 0, routeMinutes: 0 };
  const totals = calculateEatsPricing({
    subtotal,
    commissionRate: 0.1,
    deliveryMode: restaurant.delivery_mode,
    distanceKm: route.distanceKm,
    routeMinutes: route.routeMinutes,
    restaurantDeliveryFee: restaurant.delivery_fee,
  });

  return {
    restaurant,
    items,
    subtotal,
    service_fee: totals.serviceFee,
    delivery_fee: totals.deliveryFee,
    total: totals.total,
    courier_offer_amount: totals.courierOfferAmount,
    delivery_distance_km: totals.distanceKm,
    estimated_delivery_minutes: totals.estimatedDeliveryMinutes,
    restaurant_commission: totals.restaurantCommission,
    commission_rate: 0.1,
    restaurant_net: Number((subtotal - totals.restaurantCommission).toFixed(2)),
    delivery_address: route.deliveryAddress,
    currency: "EUR",
    estimated: !body.delivery_address,
    courier_guarantee_hourly: VASI_COURIER_RATES.guaranteedHourly,
    courier_minimum: VASI_COURIER_RATES.minimum,
  };
}

async function authenticatedUser(authorization) {
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET")
      return res.status(200).json({ restaurants: await catalog(), mode: "partner_catalog" });
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST required" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const priced = await price(body);
    if (body.action !== "book") return res.status(200).json(priced);

    const authorization = req.headers.authorization || "";
    const user = await authenticatedUser(authorization);
    if (!user) return res.status(401).json({ error: "Login required" });
    if (!priced.delivery_address)
      return res.status(400).json({ error: "Enter a valid full delivery address" });

    const rows = await adminDb("eats_orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        customer_id: user.id,
        restaurant_id: priced.restaurant.id,
        restaurant_name: priced.restaurant.name,
        items: priced.items,
        delivery_address: priced.delivery_address,
        subtotal: priced.subtotal,
        service_fee: priced.service_fee,
        delivery_mode: priced.restaurant.delivery_mode === "own" ? "own" : "vasi",
        delivery_fee: priced.delivery_fee,
        total: priced.total,
        currency: priced.currency,
        commission_rate: 0.1,
        restaurant_commission: priced.restaurant_commission,
        restaurant_net: priced.restaurant_net,
        delivery_distance_km: priced.delivery_distance_km,
        estimated_delivery_minutes: priced.estimated_delivery_minutes,
        courier_offer_amount: priced.courier_offer_amount,
        payment_status: "unpaid",
        courier_payout_status: "not_ready",
        status: "awaiting_payment",
      }),
    });
    const orderId = rows[0]?.id || null;
    if (!orderId) throw new Error("Order was created without an ID");
    return res.status(201).json({ ...priced, order_id: orderId, payment_required: true });
  } catch (error) {
    const message = error?.message || "Eats service error";
    const clientError = /invalid|choose|address|minimum|closed|unavailable|outside|route/i.test(
      message,
    );
    return res.status(clientError ? 400 : 502).json({ error: message });
  }
}
