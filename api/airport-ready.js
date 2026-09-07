const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  const rideId = String(req.body?.ride_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(rideId))
    return res.status(400).json({ error: "Valid ride id required" });

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/vasi_customer_airport_ready`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_ride_id: rideId, p_ready: true }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      return res.status(response.status).json({
        error: data?.message || data?.error || "Could not notify the driver",
      });
    return res.status(200).json(data);
  } catch (error) {
    return res
      .status(502)
      .json({ error: error?.message || "Airport ready signal unavailable" });
  }
}
