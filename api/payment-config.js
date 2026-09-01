export default function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET required" });
  res.setHeader("Cache-Control", "no-store");
  const publishableKey =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey)
    return res.status(200).json({ enabled: false, publishable_key: null });
  return res
    .status(200)
    .json({ enabled: true, publishable_key: publishableKey });
}
