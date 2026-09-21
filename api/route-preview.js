const REGIONS = {
  FR: { countryCode: "fr", language: "fr", googleRegion: "fr" },
  GB: { countryCode: "gb", language: "en", googleRegion: "uk" },
};
function region(value) {
  return REGIONS[String(value || "FR").toUpperCase()] || REGIONS.FR;
}
const ALLOWED_ORIGINS = new Set([
  "https://nantha010789-collab.github.io",
  "https://vasi-new.vercel.app",
  "https://vasigo.eu",
  "https://www.vasigo.eu",
]);

function cors(req, res) {
  const origin = String(req.headers?.origin || "").trim();
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function googleAddress(result) {
  const components = Object.fromEntries(
    (result?.address_components || []).flatMap((component) =>
      (component.types || []).map((type) => [type, component.long_name]),
    ),
  );
  return {
    lat: String(result.geometry?.location?.lat),
    lon: String(result.geometry?.location?.lng),
    display_name: result.formatted_address,
    address: {
      house_number: components.street_number,
      road: components.route,
      postcode: components.postal_code,
      city:
        components.locality ||
        components.postal_town ||
        components.administrative_area_level_2,
      country: components.country,
      country_code: String(
        (result?.address_components || []).find((component) =>
          component.types?.includes("country"),
        )?.short_name || "",
      ).toLowerCase(),
    },
  };
}

async function getJson(url, label) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "VASI/1.0 (contact@vasigo.eu)" },
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

async function postJson(url, body, headers, label) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
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

function googleMapsKey() {
  return String(
    process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_KEY ||
      process.env.GOOGLEMAPSERVERKEY ||
      process.env.GOOGLEMAPSSERVERKEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "",
  ).trim();
}

function seconds(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/s$/, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeGooglePolyline(encoded) {
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < String(encoded || "").length) {
    const values = [];
    for (let axis = 0; axis < 2; axis++) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index <= encoded.length);
      values.push(result & 1 ? ~(result >> 1) : result >> 1);
    }
    latitude += values[0];
    longitude += values[1];
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }
  return coordinates;
}

function googleManeuver(value) {
  const maneuver = String(value || "STRAIGHT").toUpperCase();
  if (maneuver === "DEPART") return { type: "depart", modifier: "straight" };
  if (maneuver === "DESTINATION" || maneuver.startsWith("DESTINATION_"))
    return { type: "arrive", modifier: "straight" };
  if (maneuver.includes("ROUNDABOUT"))
    return {
      type: "roundabout",
      modifier: maneuver.includes("LEFT") ? "left" : "right",
    };
  if (maneuver.includes("UTURN")) return { type: "turn", modifier: "uturn" };
  const side = maneuver.includes("LEFT")
    ? "left"
    : maneuver.includes("RIGHT")
      ? "right"
      : "straight";
  const modifier = maneuver.includes("SLIGHT") ? `slight ${side}` : side;
  return { type: side === "straight" ? "continue" : "turn", modifier };
}

function normalizeGoogleRoute(route) {
  const coordinates = decodeGooglePolyline(route?.polyline?.encodedPolyline);
  if (
    coordinates.length < 2 ||
    !Number.isFinite(route?.distanceMeters) ||
    !seconds(route?.duration)
  )
    return null;
  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).slice(0, 24).map((step) => {
      const mapped = googleManeuver(step.navigationInstruction?.maneuver);
      const location = step.startLocation?.latLng;
      return {
        distance_m: Math.round(Number(step.distanceMeters) || 0),
        duration_s: Math.round(seconds(step.staticDuration)),
        name: String(step.navigationInstruction?.instructions || "").slice(0, 160),
        instruction: String(step.navigationInstruction?.instructions || "").slice(0, 200),
        type: mapped.type,
        modifier: mapped.modifier,
        location:
          Number.isFinite(location?.longitude) && Number.isFinite(location?.latitude)
            ? [location.longitude, location.latitude]
            : null,
      };
    }),
  );
  return {
    provider: "google-routes",
    traffic_aware: true,
    distance_km: route.distanceMeters / 1000,
    duration_min: Math.ceil(seconds(route.duration) / 60),
    geometry: { type: "LineString", coordinates },
    steps,
  };
}

async function googleDrivingRoute(points, key) {
  const waypoint = (point) => ({
    location: { latLng: { latitude: point.lat, longitude: point.lng } },
  });
  const data = await postJson(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: waypoint(points[0]),
      destination: waypoint(points.at(-1)),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      languageCode: "fr-FR",
      units: "METRIC",
    },
    {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.startLocation,routes.legs.steps.navigationInstruction",
    },
    "Google Routes",
  );
  return normalizeGoogleRoute(data?.routes?.[0]);
}

function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method === "GET") {
      const requestedLat = req.query?.lat,
        requestedLng = req.query?.lng,
        hasReverseCoordinates = requestedLat !== undefined || requestedLng !== undefined,
        reverseLat = coordinate(requestedLat, -90, 90),
        reverseLng = coordinate(requestedLng, -180, 180),
        selectedRegion = region(req.query?.country),
        googleKey = googleMapsKey();
      if (hasReverseCoordinates) {
        if (reverseLat === null || reverseLng === null)
          return res.status(400).json({ error: "Invalid map coordinates" });
        let result = null;
        if (googleKey) {
          try {
            const google = await getJson(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${reverseLat},${reverseLng}&language=${selectedRegion.language}&region=${selectedRegion.googleRegion}&key=${encodeURIComponent(googleKey)}`,
              "Google reverse geocoding",
            );
            const first = google?.results?.[0];
            if (first) result = googleAddress(first);
          } catch (error) {
            console.warn("[route-preview] Google reverse geocoder failed", error?.message);
          }
        }
        if (!result) {
          try {
            const reverse = await getJson(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${reverseLat}&lon=${reverseLng}`,
              "Map address lookup",
            );
            if (reverse?.display_name) result = reverse;
          } catch (error) {
            console.warn("[route-preview] reverse geocoder failed", error?.message);
          }
        }
        return res.status(200).json({ result });
      }
      const query = String(req.query?.q || "")
        .trim()
        .slice(0, 240);
      if (query.length < 3)
        return res.status(400).json({ error: "Enter a destination" });
      let results = [];
      if (googleKey) {
        try {
          const google = await getJson(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=${selectedRegion.language}&region=${selectedRegion.googleRegion}&key=${encodeURIComponent(googleKey)}`,
            "Google Geocoding",
          );
          results = (google?.results || []).slice(0, 3).map(googleAddress);
        } catch (error) {
          console.warn("[route-preview] Google geocoder failed", error?.message);
        }
      }
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=${selectedRegion.countryCode}&q=${encodeURIComponent(query)}`;
      try {
        if (!results.length) results = await getJson(url, "Address search");
      } catch (error) {
        console.warn("[route-preview] primary geocoder failed", error?.message);
      }
      if (Array.isArray(results) && results.length)
        return res.status(200).json({ results });
      if (selectedRegion.countryCode !== "fr")
        return res.status(200).json({ results: [] });
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
    const googleKey = googleMapsKey();
    if (googleKey) {
      try {
        const googleRoute = await googleDrivingRoute(points, googleKey);
        if (googleRoute) return res.status(200).json(googleRoute);
      } catch (error) {
        console.warn("[route-preview] Google Routes failed", error?.message);
      }
    }
    const coordinates = points
      .map((point) => `${point.lng},${point.lat}`)
      .join(";");
    const data = await getJson(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
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
      provider: "osrm",
      traffic_aware: false,
      distance_km: route.distance / 1000,
      duration_min: Math.ceil(route.duration / 60),
      geometry: route.geometry,
      steps: (route.legs || []).flatMap((leg) =>
        (leg.steps || []).slice(0, 24).map((step) => ({
          distance_m: Math.round(Number(step.distance) || 0),
          duration_s: Math.round(Number(step.duration) || 0),
          name: String(step.name || "").slice(0, 160),
          type: String(step.maneuver?.type || "continue").slice(0, 40),
          modifier: String(step.maneuver?.modifier || "straight").slice(0, 40),
          location: Array.isArray(step.maneuver?.location)
            ? step.maneuver.location.slice(0, 2).map(Number)
            : null,
        })),
      ),
    });
  } catch (error) {
    return res
      .status(503)
      .json({ error: error?.message || "Map service unavailable" });
  }
}
