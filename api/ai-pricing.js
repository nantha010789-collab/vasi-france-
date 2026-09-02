const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const anonKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";
const vehicleKeys = ["go", "comfort", "xl", "van"];

function cleanRates(source) {
  const rates = {};
  for (const key of vehicleKeys) {
    const row = source?.[key] || {};
    rates[key] = {};
    for (const field of ["base", "km", "min", "minFare"]) {
      const n = Number(row[field]);
      if (!Number.isFinite(n) || n < 0 || n > 1000)
        throw Error(`Invalid ${key} ${field}`);
      rates[key][field] = Number(n.toFixed(2));
    }
  }
  return rates;
}
function safeSuggestion(current, marketAverage, demand, mode) {
  const factor = demand === "low" ? 0.95 : demand === "high" ? 1 : 0.98;
  const rates = {};
  for (const key of vehicleKeys) {
    const c = current[key];
    rates[key] = {
      base: +(c.base * factor).toFixed(2),
      km: +(c.km * factor).toFixed(2),
      min: +(c.min * factor).toFixed(2),
      minFare: +(c.minFare * factor).toFixed(2),
    };
  }
  return {
    offer_name: demand === "low" ? "VASI Smart Saver" : "VASI offer price",
    offer_mode: mode,
    discount_percent: demand === "low" ? 12 : demand === "high" ? 5 : 8,
    max_discount_eur: marketAverage
      ? Math.max(3, Math.min(10, +(marketAverage * 0.3).toFixed(2)))
      : 6,
    minimum_regular_fare: 12,
    rates,
    confidence: "medium",
    rationale: `Safe recommendation based on current VASI rates${marketAverage ? ` and the €${marketAverage.toFixed(2)} market reference` : ""}. Final approval is required.`,
    safeguards: [
      "Admin approval required",
      "No automatic publishing",
      "Review margin and driver earnings before saving",
    ],
  };
}
function parseJson(text) {
  const raw = String(text || "")
    .replace(/^```json\s*|\s*```$/g, "")
    .trim();
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer "))
    return res.status(401).json({ error: "Admin sign-in required" });
  const headers = {
    apikey: anonKey,
    Authorization: auth,
    "Content-Type": "application/json",
  };
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers,
    });
    if (!userResponse.ok)
      return res.status(401).json({ error: "Session expired" });
    const accessResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/vasi_is_admin`,
      { method: "POST", headers, body: "{}" },
    );
    const allowed = await accessResponse.json();
    if (!accessResponse.ok || allowed !== true)
      return res.status(403).json({ error: "VASI Admin access required" });
    const current = cleanRates(req.body?.current);
    const marketAverage = Number(req.body?.market_average_eur) || 0;
    const demand = ["low", "normal", "high"].includes(req.body?.demand)
      ? req.body.demand
      : "normal";
    const mode = req.body?.offer_mode === "percentage" ? "percentage" : "fixed";
    const fallback = safeSuggestion(current, marketAverage, demand, mode);
    if (mode === "percentage")
      return res
        .status(200)
        .json({ ...fallback, engine: "VASI AI safety rules" });
    if (!process.env.OPENAI_API_KEY)
      return res
        .status(200)
        .json({ ...fallback, engine: "VASI pricing rules" });
    const prompt = {
      currency: "EUR",
      market_average_eur: marketAverage || null,
      demand,
      current_rates: current,
      goals: [
        "Keep VASI attractive versus competitors",
        "Protect driver earnings and platform margin",
        "Avoid unsafe or extreme price changes",
      ],
      constraints: [
        "Return all four vehicles",
        "Each numeric change must stay within 10% of current rate",
        "Never publish automatically",
      ],
    };
    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_PRICING_MODEL ||
          process.env.OPENAI_SUPPORT_MODEL ||
          "gpt-5-mini",
        instructions:
          "You are the VASI pricing analyst. Return JSON only with keys offer_name, confidence (low|medium|high), rationale, safeguards (array), rates. rates must contain go, comfort, xl, van; each has base, km, min, minFare numbers. Recommend modest, commercially safe offer rates. Do not claim to have live competitor data; use only the supplied market reference.",
        input: JSON.stringify(prompt),
      }),
    });
    if (!ai.ok)
      return res
        .status(200)
        .json({ ...fallback, engine: "VASI pricing rules" });
    const data = await ai.json(),
      parsed = parseJson(
        data.output_text ||
          data.output
            ?.flatMap((x) => x.content || [])
            .find((x) => x.type === "output_text")?.text,
      );
    const proposed = cleanRates(parsed.rates);
    for (const key of vehicleKeys)
      for (const field of ["base", "km", "min", "minFare"]) {
        const ratio = current[key][field]
          ? proposed[key][field] / current[key][field]
          : 1;
        if (ratio < 0.9 || ratio > 1.1)
          throw Error("AI suggestion exceeded safety limits");
      }
    return res.status(200).json({
      offer_name: String(parsed.offer_name || fallback.offer_name).slice(0, 80),
      confidence: ["low", "medium", "high"].includes(parsed.confidence)
        ? parsed.confidence
        : "medium",
      rationale: String(parsed.rationale || fallback.rationale).slice(0, 600),
      safeguards: Array.isArray(parsed.safeguards)
        ? parsed.safeguards.slice(0, 5).map((x) => String(x).slice(0, 120))
        : fallback.safeguards,
      rates: proposed,
      engine: "VASI AI",
    });
  } catch (e) {
    return res
      .status(400)
      .json({ error: e?.message || "AI pricing analysis failed" });
  }
}
