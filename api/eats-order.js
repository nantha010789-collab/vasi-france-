const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publishableKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

const restaurants = [
  { id: "vasi-burger", name: "VASI Burger Kitchen", cuisine: "Burgers", eta: "20–30 min", icon: "🍔", items: [
    { id: "classic-burger", name: "Classic Burger", price: 8.9 },
    { id: "cheese-burger", name: "Cheese Burger", price: 9.9 },
    { id: "fries", name: "French Fries", price: 3.5 },
  ] },
  { id: "vasi-pizza", name: "VASI Pizza Kitchen", cuisine: "Pizza", eta: "25–35 min", icon: "🍕", items: [
    { id: "margherita", name: "Margherita", price: 9.5 },
    { id: "pepperoni", name: "Pepperoni Pizza", price: 11.5 },
    { id: "garlic-bread", name: "Garlic Bread", price: 4.5 },
  ] },
  { id: "vasi-asian", name: "VASI Asian Kitchen", cuisine: "Asian", eta: "30–40 min", icon: "🍜", items: [
    { id: "noodles", name: "Vegetable Noodles", price: 10.9 },
    { id: "chicken-rice", name: "Chicken Rice Bowl", price: 12.5 },
    { id: "sushi-box", name: "Sushi Box", price: 13.9 },
  ] },
];

function priceOrder(body) {
  const restaurant = restaurants.find((r) => r.id === body.restaurant_id);
  if (!restaurant) throw new Error("Restaurant not found");
  const requested = Array.isArray(body.items) ? body.items : [];
  if (!requested.length || requested.length > 20) throw new Error("Choose at least one valid item");
  const items = requested.map((entry) => {
    const menuItem = restaurant.items.find((item) => item.id === String(entry.id || ""));
    const quantity = Number(entry.quantity);
    if (!menuItem || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Invalid basket item");
    return { id: menuItem.id, name: menuItem.name, price: menuItem.price, quantity, line_total: Number((menuItem.price * quantity).toFixed(2)) };
  });
  const subtotal = Number(items.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
  const deliveryFee = subtotal >= 25 ? 0 : 2.99;
  return { restaurant, items, subtotal, delivery_fee: deliveryFee, total: Number((subtotal + deliveryFee).toFixed(2)), currency: "EUR" };
}

async function getUser(authorization) {
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: authorization } });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

async function normalizeAddress(value) {
  const address = String(value || "").trim();
  if (address.length < 6 || address.length > 200) throw new Error("Enter a valid full delivery address");
  const query = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "fr,gb,be,de,nl,lu,ch,es,it,pt", q: address });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, { headers: { "User-Agent": "VASI/1.0 (eats-checkout)" } });
  if (!response.ok) throw new Error("Address search is temporarily unavailable");
  const match = (await response.json())?.[0];
  if (!match) throw new Error("Delivery address not found");
  return match.display_name || address;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ restaurants, mode: "launch_catalog" });
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST required" });
  try {
    const body = req.body || {};
    const priced = priceOrder(body);
    if (body.action !== "book") return res.status(200).json(priced);
    const authorization = req.headers.authorization || "";
    const user = await getUser(authorization);
    if (!user) return res.status(401).json({ error: "Login required" });
    const deliveryAddress = await normalizeAddress(body.delivery_address);
    const response = await fetch(`${supabaseUrl}/rest/v1/eats_orders`, {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: authorization, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ customer_id: user.id, restaurant_name: priced.restaurant.name, items: priced.items, delivery_address: deliveryAddress, subtotal: priced.subtotal, delivery_fee: priced.delivery_fee, total: priced.total, currency: priced.currency, status: "pending" }),
    });
    const created = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: created?.message || created?.error || "Could not place order" });
    const order = Array.isArray(created) ? created[0] : created;
    return res.status(201).json({ ...priced, delivery_address: deliveryAddress, order_id: order?.id || null });
  } catch (error) {
    const message = error?.message || "Eats service error";
    return res.status(/invalid|choose|not found|address/i.test(message) ? 400 : 502).json({ error: message });
  }
}
