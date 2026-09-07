const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publicKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });
  const auth = req.headers.authorization || "";
  const rideId = String(req.query?.ride_id || "");
  if (!auth.startsWith("Bearer ") || !/^[0-9a-f-]{36}$/i.test(rideId)) return res.status(401).json({ error: "Login and ride required" });
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${encodeURIComponent(rideId)}&select=id,flight_number,flight_status,flight_status_checked_at`, { headers: { apikey: publicKey, Authorization: auth } });
    const rides = await response.json();
    const ride = rides?.[0];
    if (!response.ok || !ride) return res.status(404).json({ error: "Ride not found" });
    if (!ride.flight_number) return res.status(200).json({ available: false, status: "not_requested" });
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) return res.status(200).json({ available: false, flight_number: ride.flight_number, status: ride.flight_status || "tracking_requested", message: "Live flight data provider connection is pending" });
    const flightResponse = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(apiKey)}&flight_iata=${encodeURIComponent(ride.flight_number)}&limit=1`);
    const flightData = await flightResponse.json();
    if (!flightResponse.ok) throw new Error("Flight data provider is temporarily unavailable");
    const flight = flightData?.data?.[0];
    const status = String(flight?.flight_status || "not_found").slice(0, 40);
    if (serviceKey) await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${encodeURIComponent(rideId)}`, { method: "PATCH", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ flight_status: status, flight_status_checked_at: new Date().toISOString() }) });
    return res.status(200).json({ available: true, flight_number: ride.flight_number, status, departure: flight?.departure || null, arrival: flight?.arrival || null, updated_at: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Flight status unavailable" });
  }
}
