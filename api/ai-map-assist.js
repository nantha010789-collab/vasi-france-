const MAX_QUERY_LENGTH = 160;
const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

function cleanQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function isSafeSuggestion(value) {
  if (value.length < 3 || value.length > MAX_QUERY_LENGTH) return false;
  if (/^(?:https?:\/\/|www\.)/i.test(value)) return false;
  // Coordinates must always come from VASI's trusted geocoder, never the model.
  if (/^[-+]?\d{1,3}(?:\.\d+)?\s*[,;]\s*[-+]?\d{1,3}(?:\.\d+)?$/.test(value))
    return false;
  return true;
}

function outputText(data) {
  return (
    data?.output_text ||
    data?.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text ||
    ""
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });

  const query = cleanQuery(req.body?.query);
  if (query.length < 3)
    return res.status(400).json({ error: "Enter a complete address" });
  const kind = req.body?.kind === "pickup" ? "pickup" : "destination";
  const auth = req.headers?.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Sign in required" });

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: auth },
    });
    if (!userResponse.ok)
      return res.status(401).json({ error: "Session expired" });
  } catch (error) {
    return res.status(503).json({ error: "Sign-in check unavailable" });
  }

  if (!process.env.OPENAI_API_KEY)
    return res.status(200).json({ enabled: false, suggestions: [] });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_MAP_MODEL ||
          process.env.OPENAI_SUPPORT_MODEL ||
          "gpt-5-mini",
        instructions:
          "Correct or expand a user's place-search text for a real map geocoder. Return at most 3 likely search strings. Preserve every explicit street number, postcode, city and country. Never invent a missing street number or postcode. Prefer France and nearby Europe only when the input supports it. Do not provide directions, navigation, coordinates, URLs or explanations.",
        input: JSON.stringify({ query, kind, locale: "fr-FR" }),
        text: {
          format: {
            type: "json_schema",
            name: "vasi_map_search_suggestions",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                suggestions: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string", minLength: 3, maxLength: 160 },
                },
              },
              required: ["suggestions"],
            },
          },
        },
        max_output_tokens: 220,
      }),
    });
    if (!response.ok)
      return res.status(200).json({ enabled: false, suggestions: [] });

    const parsed = JSON.parse(outputText(await response.json()));
    const suggestions = [...new Set((parsed?.suggestions || []).map(cleanQuery))]
      .filter((value) => value !== query && isSafeSuggestion(value))
      .slice(0, 3);
    return res.status(200).json({ enabled: true, suggestions });
  } catch (error) {
    console.warn("[ai-map-assist] fallback", error?.message);
    return res.status(200).json({ enabled: false, suggestions: [] });
  }
}
