const COUNTRIES = "fr,gb,be,de,nl,lu,ch,es,it,pt";

async function getJson(url, label) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "VASI/1.0 (support@vasi.fr)" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${label} returned ${response.status}`);
      return await response.json();
    } catch (error) {
      last = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error(`${label} unavailable`);
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const query = String(req.query?.q || "")
        .trim()
        .slice(0, 240);
      if (query.length < 3)
        return res.status(400).json({ error: "Enter a destination" });
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=${COUNTRIES}&q=${encodeURIComponent(query)}`;
      let results = [];
      try {
        results = await getJson(url, "Address search");
      } catch (error) {
        console.warn("[route-preview] primary geocoder failed", error?.message);
      }
      if (Array.isArray(results) && results.length)
        return res.status(200).json({ results });
      const france = await getJson(
        `https://api-adresse.data.gouv.fr/search/?limit=3&q=${encodeURIComponent(query)}`,
        "France address search",
      );
      const fallback = (france?.features || []).map((feature) => ({
        lat: String(feature.geometry?.coordinates?.[1]),
        lon: String(feature.geometry?.coordinates?.[0]),
        display_name: feature.properties?.label,
        address: {
          house_number: feature.properties?.housenumber,
          road: feature.properties?.street || feature.properties?.name,
          postcode: feature.properties?.postcode,
          city: feature.properties?.city,
          country: "France",
          country_code: "fr",
        },
      }));
      return res.status(200).json({ results: fallback });
    }
    if (req.method !== "POST")
      return res.status(405).json({ error: "GET or POST required" });
    const raw = Array.isArray(req.body?.points) ? req.body.points : [];
    if (raw.length < 2 || raw.length > 7)
      return res.status(400).json({ error: "Invalid route points" });
    const points = raw.map((point) => ({
      lat: coordinate(point?.lat, -90, 90),
      lng: coordinate(point?.lng, -180, 180),
    }));
    if (points.some((point) => point.lat === null || point.lng === null))
      return res.status(400).json({ error: "Invalid route coordinates" });
    const coordinates = points
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
    const data = await getJson(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
      "Route service",
    );
    const route = data?.routes?.[0];
    if (
      !route?.geometry ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration)
    )
      return res.status(404).json({ error: "No driving route found" });
    return res.status(200).json({
      distance_km: route.distance / 1000,
      duration_min: Math.ceil(route.duration / 60),
      geometry: route.geometry,
    });
  } catch (error) {
    return res
      .status(503)
      .json({ error: error?.message || "Map service unavailable" });
  }
}
