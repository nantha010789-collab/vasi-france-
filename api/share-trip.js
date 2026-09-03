const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function signedInUser(authorization) {
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: authorization,
    },
  });
  return response.ok ? response.json() : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!["POST", "DELETE"].includes(req.method))
    return res.status(405).json({ error: "POST or DELETE required" });
  if (!supabaseUrl || !serviceKey)
    return res.status(503).json({ error: "Safety service is not configured" });

  try {
    const authorization = req.headers.authorization || "";
    const user = await signedInUser(authorization);
    if (!user?.id) return res.status(401).json({ error: "Login required" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const rideId = String(body.ride_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(rideId))
      return res.status(400).json({ error: "Valid ride id required" });

    const rideResponse = await fetch(
      `${supabaseUrl}/rest/v1/rides?select=id,status&` +
        `id=eq.${encodeURIComponent(rideId)}&customer_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers: serviceHeaders() },
    );
    const rides = await rideResponse.json();
    if (!rideResponse.ok || !rides?.length)
      return res.status(404).json({ error: "Ride not found" });

    const enable = req.method === "POST";
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ride_safety?ride_id=eq.${encodeURIComponent(rideId)}`,
      {
        method: "PATCH",
        headers: serviceHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({
          sharing_enabled: enable,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const rows = await updateResponse.json();
    if (!updateResponse.ok || !rows?.length)
      return res.status(500).json({ error: "Trip sharing could not be updated" });

    const token = rows[0].share_token;
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "vasi-new.vercel.app").split(",")[0];
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const shareUrl = `${forwardedProto}://${forwardedHost}/share-ride.html?token=${encodeURIComponent(token)}`;
    return res.status(200).json({
      enabled: enable,
      share_url: enable ? shareUrl : null,
      expires_at: rows[0].share_expires_at,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Safety service unavailable" });
  }
}
