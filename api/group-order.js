const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publicKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function request(path, options = {}, admin = false) {
  const key = admin ? serviceKey : publicKey;
  if (!key) throw new Error("Group ordering service is not configured");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Group order database request failed");
  return data;
}

async function userFrom(auth) {
  if (!auth.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: auth } });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

const validUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
function cleanItems(value) {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Choose up to 20 menu items");
  return value.map((entry) => {
    const id = String(entry?.id || "");
    const quantity = Number(entry?.quantity);
    if (!validUuid(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("Invalid group basket item");
    return { id, quantity };
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "GET or POST required" });
  try {
    const user = await userFrom(req.headers.authorization || "");
    if (!user) return res.status(401).json({ error: "Login required" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = req.method === "GET" ? "view" : String(body.action || "view");
    const token = String(req.query?.token || body.token || "");

    if (action === "create") {
      if (!validUuid(body.restaurant_id)) return res.status(400).json({ error: "Choose a restaurant first" });
      const rows = await request("eats_group_orders", {
        method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ host_user_id: user.id, restaurant_id: body.restaurant_id }),
      }, true);
      const group = rows?.[0];
      if (!group) throw new Error("Group order was not created");
      const items = cleanItems(body.items || []);
      if (items.length) await request("eats_group_order_members", {
        method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ group_order_id: group.id, user_id: user.id, display_name: String(body.display_name || "Host").trim().slice(0, 80) || "Host", items }),
      }, true);
      return res.status(201).json({ group_id: group.id, token: group.invite_token, invite_url: `${req.headers.origin || "https://vasi-new.vercel.app"}/group-order.html?token=${group.invite_token}` });
    }

    if (!validUuid(token)) return res.status(400).json({ error: "Valid group invitation required" });
    const groups = await request(`eats_group_orders?invite_token=eq.${encodeURIComponent(token)}&select=id,host_user_id,restaurant_id,status,expires_at`, {}, true);
    const group = groups?.[0];
    if (!group || group.status === "expired" || new Date(group.expires_at).getTime() <= Date.now()) return res.status(404).json({ error: "This group order invitation has expired" });

    if (action === "join") {
      if (group.status !== "open") return res.status(409).json({ error: "This group basket is already closed" });
      const items = cleanItems(body.items || []);
      if (!items.length) return res.status(400).json({ error: "Add at least one item" });
      await request("eats_group_order_members?on_conflict=group_order_id,user_id", {
        method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ group_order_id: group.id, user_id: user.id, display_name: String(body.display_name || "Guest").trim().slice(0, 80) || "Guest", items, updated_at: new Date().toISOString() }),
      }, true);
    }

    if (action === "close") {
      if (group.host_user_id !== user.id) return res.status(403).json({ error: "Only the group host can close checkout" });
      if (group.status !== "open") return res.status(409).json({ error: "Group basket is already closed" });
      await request(`eats_group_orders?id=eq.${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: "closed", updated_at: new Date().toISOString() }) }, true);
      group.status = "closed";
    }

    const members = await request(`eats_group_order_members?group_order_id=eq.${group.id}&select=display_name,items,updated_at&order=updated_at.asc`, {}, true);
    const totals = new Map();
    for (const member of members || []) for (const item of member.items || []) totals.set(item.id, (totals.get(item.id) || 0) + Number(item.quantity || 0));
    return res.status(200).json({
      group_id: group.id, restaurant_id: group.restaurant_id, status: group.status,
      is_host: group.host_user_id === user.id, participant_count: members?.length || 0,
      participants: (members || []).map((member) => ({ display_name: member.display_name, item_count: (member.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0) })),
      items: [...totals.entries()].map(([id, quantity]) => ({ id, quantity })),
    });
  } catch (error) {
    const message = error?.message || "Group ordering failed";
    return res.status(/invalid|choose|expired|closed|required/i.test(message) ? 400 : 500).json({ error: message });
  }
}
