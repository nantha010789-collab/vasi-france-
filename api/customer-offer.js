const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET required" });
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Sign-in required" });
  const headers = { apikey: anonKey, Authorization: auth };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers,
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user?.id)
      return res.status(401).json({ error: "Session expired" });
    const ridesResponse = await fetch(
      `${supabaseUrl}/rest/v1/rides?select=status,completed_at,requested_at&customer_id=eq.${encodeURIComponent(user.id)}&order=requested_at.desc&limit=100`,
      { headers },
    );
    if (!ridesResponse.ok) throw Error("Could not analyse ride activity");
    const completed = (await ridesResponse.json()).filter(
      (ride) => ride.status === "completed",
    );
    const lastRide =
      completed[0]?.completed_at || completed[0]?.requested_at || null;
    const inactive =
      lastRide && Date.now() - Date.parse(lastRide) >= 30 * 86400000;
    const percent = completed.length === 0 || inactive ? 15 : 10;
    return res
      .status(200)
      .json({
        active: true,
        discount_percent: percent,
        max_discount_eur: 6,
        reason:
          completed.length === 0
            ? "welcome"
            : inactive
              ? "welcome_back"
              : "loyalty",
        label:
          completed.length === 0
            ? "VASI Welcome"
            : inactive
              ? "VASI Welcome Back"
              : "VASI Loyalty",
        safeguards: {
          allowed_percentages: [10, 15],
          sensitive_data_used: false,
          driver_pay_protected: true,
        },
      });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Offer service unavailable" });
  }
}
