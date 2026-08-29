export default function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(503).json({ error: 'Google Maps key is not configured' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ key });
}
