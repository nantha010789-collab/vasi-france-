const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: 'Supabase environment is not configured' });
  const rideId = String(req.query?.id || '');
  if (!rideId) return res.status(400).json({ error: 'Ride id required' });
  try {
    const url = `${supabaseUrl}/rest/v1/rides?select=*&id=eq.${encodeURIComponent(rideId)}&limit=1`;
    const r = await fetch(url, { headers: { apikey: anonKey, Authorization: auth } });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.message || data?.error || 'Could not load ride' });
    if (!data?.length) return res.status(404).json({ error: 'Ride not found' });
    return res.status(200).json({ ride: data[0] });
  } catch (e) { return res.status(500).json({ error: e?.message || 'Server error' }); }
}
