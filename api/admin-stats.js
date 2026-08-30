export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.VASI_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Supabase server configuration missing' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const userToken = auth.slice(7);
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${userToken}` }
  });
  if (!userResponse.ok) return res.status(401).json({ error: 'Invalid session' });
  const user = await userResponse.json();

  const allow = await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!allow.ok || (await allow.json()).length === 0) return res.status(403).json({ error: 'Admin access required' });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  async function count(table, extra = '') {
    const r = await fetch(`${url}/rest/v1/${table}?select=id${extra}`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } });
    if (!r.ok) return null;
    const range = r.headers.get('content-range');
    return range ? Number(range.split('/')[1]) || 0 : null;
  }
  const [drivers, customers, bookings, documents, payments, activeRides, onlineDrivers] = await Promise.all([
    count('drivers'), count('profiles', '&role=eq.customer'), count('bookings'), count('driver_documents'), count('payments'), count('rides', '&status=in.(requested,accepted,arriving,in_progress)'), count('drivers', '&is_online=eq.true')
  ]);
  return res.status(200).json({ drivers, customers, bookings, documents, payments, activeRides, onlineDrivers });
}
