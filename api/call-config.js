const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://vhfyvkrvysrooaqzcxsp.supabase.co";
const publishableKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT";

const fallback = {
  urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
};

async function authenticated(authorization) {
  if (!authorization.startsWith("Bearer ")) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: authorization },
  });
  if (!response.ok) return false;
  const user = await response.json();
  return Boolean(user?.id);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "GET required" });
  const authorization = req.headers.authorization || "";
  if (!(await authenticated(authorization))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const urls = String(process.env.VASI_TURN_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^turns?:/i.test(value));
  const username = String(process.env.VASI_TURN_USERNAME || "").trim();
  const credential = String(process.env.VASI_TURN_CREDENTIAL || "").trim();
  const iceServers = [fallback];
  if (urls.length && username && credential) {
    iceServers.push({ urls, username, credential });
  }
  return res.status(200).json({ iceServers, turnConfigured: iceServers.length > 1 });
}
