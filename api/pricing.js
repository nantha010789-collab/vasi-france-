const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

const fields = [
  "go_base",
  "go_per_km",
  "go_per_minute",
  "go_minimum",
  "comfort_base",
  "comfort_per_km",
  "comfort_per_minute",
  "comfort_minimum",
  "xl_base",
  "xl_per_km",
  "xl_per_minute",
  "xl_minimum",
  "van_base",
  "van_per_km",
  "van_per_minute",
  "van_minimum",
];
const fallback = {
  offer_active: true,
  offer_name: "VASI offer price",
  starts_at: null,
  ends_at: null,
  offer_mode: "fixed",
  discount_percent: 10,
  max_discount_eur: null,
  minimum_regular_fare: null,
  go_base: 1.5,
  go_per_km: 0.68,
  go_per_minute: 0.14,
  go_minimum: 7.5,
  comfort_base: 2,
  comfort_per_km: 0.78,
  comfort_per_minute: 0.16,
  comfort_minimum: 9,
  xl_base: 2.8,
  xl_per_km: 0.95,
  xl_per_minute: 0.18,
  xl_minimum: 11.5,
  van_base: 3.5,
  van_per_km: 1.05,
  van_per_minute: 0.2,
  van_minimum: 13.5,
};

function publicShape(row) {
  const now = Date.now(),
    starts = row.starts_at ? Date.parse(row.starts_at) : null,
    ends = row.ends_at ? Date.parse(row.ends_at) : null;
  const active =
    Boolean(row.offer_active) &&
    (!starts || now >= starts) &&
    (!ends || now < ends);
  const classes = {};
  for (const key of ["go", "comfort", "xl", "van"])
    classes[key] = {
      base: Number(row[key + "_base"]),
      km: Number(row[key + "_per_km"]),
      min: Number(row[key + "_per_minute"]),
      minFare: Number(row[key + "_minimum"]),
    };
  return {
    offer_active: active,
    offer_enabled: Boolean(row.offer_active),
    offer_name: row.offer_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    offer_mode: row.offer_mode === "percentage" ? "percentage" : "fixed",
    discount_percent: Number(row.discount_percent || 0),
    max_discount_eur:
      row.max_discount_eur == null ? null : Number(row.max_discount_eur),
    minimum_regular_fare:
      row.minimum_regular_fare == null
        ? null
        : Number(row.minimum_regular_fare),
    classes,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = req.headers.authorization || "";
  const headers = {
    apikey: anonKey,
    Authorization: auth.startsWith("Bearer ") ? auth : `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };
  if (req.method === "GET") {
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/vasi_pricing_settings?id=eq.active&select=*`,
        { headers },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data?.message || "Pricing unavailable");
      return res.status(200).json(publicShape(data?.[0] || fallback));
    } catch {
      return res.status(200).json(publicShape(fallback));
    }
  }
  if (req.method !== "PATCH")
    return res.status(405).json({ error: "GET or PATCH required" });
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Admin sign-in required" });
  try {
    const b = req.body || {},
      update = {};
    update.offer_active = Boolean(b.offer_active);
    update.offer_name = String(b.offer_name || "").trim();
    if (!update.offer_name || update.offer_name.length > 80)
      return res
        .status(400)
        .json({ error: "Offer name must be 1–80 characters" });
    update.offer_mode = b.offer_mode === "percentage" ? "percentage" : "fixed";
    update.discount_percent = Number(b.discount_percent);
    if (
      !Number.isFinite(update.discount_percent) ||
      update.discount_percent < 0 ||
      update.discount_percent > 50
    )
      return res
        .status(400)
        .json({ error: "Discount must be between 0% and 50%" });
    for (const key of ["max_discount_eur", "minimum_regular_fare"]) {
      update[key] = b[key] === "" || b[key] == null ? null : Number(b[key]);
      if (
        update[key] != null &&
        (!Number.isFinite(update[key]) || update[key] < 0 || update[key] > 1000)
      )
        return res.status(400).json({ error: `Invalid value for ${key}` });
    }
    for (const key of fields) {
      const n = Number(b[key]);
      if (!Number.isFinite(n) || n < 0 || n > 1000)
        return res.status(400).json({ error: `Invalid value for ${key}` });
      update[key] = n;
    }
    for (const key of ["starts_at", "ends_at"]) {
      update[key] = b[key] ? new Date(b[key]).toISOString() : null;
      if (b[key] && !Number.isFinite(Date.parse(update[key])))
        return res.status(400).json({ error: `Invalid ${key}` });
    }
    if (
      update.starts_at &&
      update.ends_at &&
      Date.parse(update.ends_at) <= Date.parse(update.starts_at)
    )
      return res
        .status(400)
        .json({ error: "End date must be after start date" });
    update.updated_at = new Date().toISOString();
    const user = await fetch(`${supabaseUrl}/auth/v1/user`, { headers }).then(
      (r) => (r.ok ? r.json() : null),
    );
    if (!user?.id) return res.status(401).json({ error: "Session expired" });
    update.updated_by = user.id;
    const r = await fetch(
      `${supabaseUrl}/rest/v1/vasi_pricing_settings?id=eq.active`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(update),
      },
    );
    const data = await r.json();
    if (!r.ok)
      return res
        .status(r.status === 403 ? 403 : 400)
        .json({ error: data?.message || "Pricing update failed" });
    if (!data?.length)
      return res
        .status(403)
        .json({ error: "Only a VASI administrator can update pricing" });
    return res.status(200).json(publicShape(data[0]));
  } catch (e) {
    return res
      .status(400)
      .json({ error: e?.message || "Pricing update failed" });
  }
}
