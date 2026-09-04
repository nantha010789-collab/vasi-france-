const GOOGLE_PLACES_URL =
  "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_GEOCODE_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";
const ALLOWED_ORIGINS = new Set([
  "https://nantha010789-collab.github.io",
  "https://vasi-new.vercel.app",
  "https://vasigo.eu",
  "https://www.vasigo.eu",
]);
const COUNTRIES = ["fr", "gb", "be", "de", "nl", "lu", "ch", "es", "it", "pt"];
const buckets = new Map();

function clean(value, max = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function googleKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ""
  ).trim();
}

function googleErrorCode(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.name === "AbortError") return "timeout";
  if (message.includes("api key not valid")) return "invalid_key";
  if (message.includes("billing")) return "billing_required";
  if (
    message.includes("has not been used") ||
    message.includes("is disabled") ||
    message.includes("not enabled")
  )
    return "api_disabled";
  if (
    message.includes("not authorized") ||
    message.includes("permission") ||
    message.includes("forbidden")
  )
    return "not_authorized";
  return "upstream_error";
}

function cors(req, res) {
  const origin = clean(req.headers?.origin, 240);
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function allowRequest(req) {
  const key = clean(
    req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
    100,
  ).split(",")[0];
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt > 60_000) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= 60;
}

async function googleJson(url, options, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data?.error?.message || `${label} returned ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function autocomplete(input, key, location) {
  const body = {
    input,
    includedRegionCodes: COUNTRIES,
    languageCode: "fr",
    regionCode: "fr",
  };
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    body.locationBias = {
      circle: { center: { latitude, longitude }, radius: 50_000 },
    };
  }
  const data = await googleJson(
    GOOGLE_PLACES_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      },
      body: JSON.stringify(body),
    },
    "Google Places",
  );
  return (data?.suggestions || [])
    .map((item) => item?.placePrediction)
    .filter((item) => item?.placeId && item?.text?.text)
    .slice(0, 5)
    .map((item) => ({
      place_id: clean(item.placeId, 180),
      label: clean(item.text.text),
      main: clean(item.structuredFormat?.mainText?.text || item.text.text),
      secondary: clean(item.structuredFormat?.secondaryText?.text || ""),
    }));
}

async function resolvePlace(placeId, key) {
  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("language", "fr");
  url.searchParams.set("region", "fr");
  url.searchParams.set("key", key);
  const data = await googleJson(url, {}, "Google Geocoding");
  const result = data?.results?.[0];
  const lat = Number(result?.geometry?.location?.lat);
  const lng = Number(result?.geometry?.location?.lng);
  if (!result || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    place_id: clean(result.place_id || placeId, 180),
    label: clean(result.formatted_address || "Selected destination"),
    lat,
    lng,
  };
}

export default async function handler(req, res) {
  cors(req, res);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  if (!allowRequest(req))
    return res.status(429).json({ error: "Too many address searches" });

  const key = googleKey();
  if (!key)
    return res.status(503).json({
      enabled: false,
      error: "Google Places is not configured",
    });

  try {
    const action = clean(req.body?.action, 24);
    if (action === "autocomplete") {
      const input = clean(req.body?.input);
      if (input.length < 4)
        return res.status(200).json({ enabled: true, suggestions: [] });
      const suggestions = await autocomplete(input, key, req.body?.location);
      return res.status(200).json({ enabled: true, suggestions });
    }
    if (action === "resolve") {
      const placeId = clean(req.body?.place_id, 180);
      if (placeId.length < 8)
        return res.status(400).json({ error: "Invalid place" });
      const place = await resolvePlace(placeId, key);
      if (!place) return res.status(404).json({ error: "Place not found" });
      return res.status(200).json({ enabled: true, place });
    }
    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    const reason = googleErrorCode(error);
    console.error(`[places] google_${reason}`);
    res.setHeader("X-VASI-Places-Status", reason);
    return res.status(503).json({
      enabled: true,
      error: "Address suggestions are temporarily unavailable",
      reason,
    });
  }
}
