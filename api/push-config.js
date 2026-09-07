export default function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "GET required" });
  res.setHeader("Cache-Control", "no-store");
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BHRmZSwkN1ZaS20fXcT6TdeFUDqOXduPuyZgFStxDh0fptXL0mBEmxxVCT_A3DlfiaZsQ-PyzPFDlOFAi7orwxo";
  return res.status(200).json({
    enabled: Boolean(publicKey),
    public_key: publicKey || null,
  });
}
