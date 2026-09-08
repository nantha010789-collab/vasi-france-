const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publicKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

const FLIGHT_PATTERN = /^[A-Z0-9]{2,3}\s?[0-9]{1,4}[A-Z]?$/;

function arrivalTime(flight) {
  return Date.parse(
    flight?.arrival?.actual ||
      flight?.arrival?.estimated ||
      flight?.arrival?.scheduled ||
      "",
  );
}

function closestFlight(flights, expectedArrival) {
  const target = Date.parse(expectedArrival || "");
  if (!Number.isFinite(target)) return flights[0] || null;
  return [...flights].sort((a, b) => {
    const aTime = arrivalTime(a);
    const bTime = arrivalTime(b);
    const aDistance = Number.isFinite(aTime) ? Math.abs(aTime - target) : Infinity;
    const bDistance = Number.isFinite(bTime) ? Math.abs(bTime - target) : Infinity;
    return aDistance - bDistance;
  })[0] || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Login required" });
  const flightNumber = String(req.query?.flight_number || "").trim().toUpperCase();
  const expectedArrival = String(req.query?.expected_arrival || "").trim();
  if (!FLIGHT_PATTERN.test(flightNumber)) {
    return res.status(400).json({ error: "Enter a valid flight number" });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: auth },
    });
    if (!userResponse.ok) return res.status(401).json({ error: "Login required" });

    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ available: false, flight_number: flightNumber });
    }
    const providerUrl = new URL("https://api.aviationstack.com/v1/flights");
    providerUrl.searchParams.set("access_key", apiKey);
    providerUrl.searchParams.set("flight_iata", flightNumber.replaceAll(" ", ""));
    providerUrl.searchParams.set("limit", "10");
    const providerResponse = await fetch(providerUrl);
    const providerData = await providerResponse.json();
    if (!providerResponse.ok) throw new Error("Flight data is temporarily unavailable");

    const flight = closestFlight(Array.isArray(providerData?.data) ? providerData.data : [], expectedArrival);
    if (!flight) {
      return res.status(200).json({ available: true, found: false, flight_number: flightNumber });
    }
    return res.status(200).json({
      available: true,
      found: true,
      flight_number: flightNumber,
      status: String(flight.flight_status || "scheduled").slice(0, 40),
      arrival: {
        airport: String(flight.arrival?.airport || "").slice(0, 120) || null,
        iata: String(flight.arrival?.iata || "").slice(0, 4).toUpperCase() || null,
        terminal: String(flight.arrival?.terminal || "").slice(0, 20) || null,
        gate: String(flight.arrival?.gate || "").slice(0, 20) || null,
        scheduled: flight.arrival?.scheduled || null,
        estimated: flight.arrival?.estimated || null,
      },
    });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Flight lookup unavailable" });
  }
}
