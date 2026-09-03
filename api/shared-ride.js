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
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });
  try {
    const token = String(req.query?.token || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))
      return res.status(400).json({ error: "Invalid trip link" });

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_shared_ride`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data?.message || "Trip data unavailable");
    if (!data) return res.status(404).json({ error: "This trip link is unavailable or expired" });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Trip sharing unavailable" });
  }
}
