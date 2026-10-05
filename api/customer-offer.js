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
      `${supabaseUrl}/rest/v1/rides?select=id&customer_id=eq.${encodeURIComponent(user.id)}&status=neq.cancelled&limit=1`,
      { headers },
    );
    if (!ridesResponse.ok) throw Error("Could not analyse ride activity");
    const eligible = (await ridesResponse.json()).length === 0;
    return res.status(200).json({
      active: eligible,
      discount_percent: eligible ? 5 : 0,
      max_discount_eur: eligible ? 1 : 0,
      reason: eligible ? "welcome" : "not_eligible",
      label: eligible ? "VASI Welcome" : null,
      safeguards: {
        allowed_percentages: [5], first_ride_only: true,
        sensitive_data_used: false, driver_pay_protected: true,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Offer service unavailable" });
  }
}
