const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!["POST", "DELETE"].includes(req.method))
    return res.status(405).json({ error: "POST or DELETE required" });
  try {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer "))
      return res.status(401).json({ error: "Login required" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const rideId = String(body.ride_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(rideId))
      return res.status(400).json({ error: "Valid ride id required" });

    const enable = req.method === "POST";
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/vasi_set_trip_sharing`,
      {
        method: "POST",
        headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ p_ride_id: rideId, p_enabled: enable }),
      },
    );
    const data = await updateResponse.json();
    if (!updateResponse.ok)
      return res.status(updateResponse.status).json({ error: data?.message || "Trip sharing could not be updated" });

    const token = data.share_token;
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "vasi-new.vercel.app").split(",")[0];
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const shareUrl = `${forwardedProto}://${forwardedHost}/share-ride.html?token=${encodeURIComponent(token)}`;
    return res.status(200).json({
      enabled: enable,
      share_url: enable ? shareUrl : null,
      expires_at: data.expires_at,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Safety service unavailable" });
  }
}
