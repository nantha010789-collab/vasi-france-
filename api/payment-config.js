export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return res.status(503).json({ error: 'Card and Apple Pay are not configured yet' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ publishable_key: publishableKey });
}
