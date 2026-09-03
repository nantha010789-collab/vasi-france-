const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers() {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

async function rows(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: headers() });
  const data = await response.json();
  if (!response.ok) throw Error(data?.message || "Trip data unavailable");
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });
  if (!supabaseUrl || !serviceKey)
    return res.status(503).json({ error: "Trip sharing is not configured" });

  try {
    const token = String(req.query?.token || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))
      return res.status(400).json({ error: "Invalid trip link" });

    const safety = (
      await rows(
        `ride_safety?select=ride_id,share_expires_at&share_token=eq.${encodeURIComponent(token)}` +
          `&sharing_enabled=eq.true&share_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
      )
    )[0];
    if (!safety) return res.status(404).json({ error: "This trip link is unavailable or expired" });

    const ride = (
      await rows(
        `rides?select=id,status,service,pickup_address,pickup_lat,pickup_lng,destination_address,destination_lat,destination_lng,requested_at,accepted_at,arrived_at,started_at,completed_at,cancelled_at,driver_id` +
          `&id=eq.${encodeURIComponent(safety.ride_id)}&limit=1`,
      )
    )[0];
    if (!ride) return res.status(404).json({ error: "Trip not found" });

    let driver = null;
    let location = null;
    if (ride.driver_id) {
      driver = (
        await rows(
          `drivers?select=full_name,vehicle_make,vehicle_model,vehicle_plate,vehicle_color,rating` +
            `&id=eq.${encodeURIComponent(ride.driver_id)}&limit=1`,
        )
      )[0] || null;
      if (["accepted", "driver_arriving", "in_progress"].includes(String(ride.status))) {
        location = (
          await rows(
            `driver_locations?select=latitude,longitude,updated_at&driver_id=eq.${encodeURIComponent(ride.driver_id)}` +
              `&order=updated_at.desc&limit=1`,
          )
        )[0] || null;
      }
    }

    delete ride.driver_id;
    return res.status(200).json({ ride, driver, location, refreshed_at: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Trip sharing unavailable" });
  }
}
