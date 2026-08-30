export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const url = process.env.VASI_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Supabase server configuration missing' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const userToken = auth.slice(7);
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${userToken}` } });
  if (!userResponse.ok) return res.status(401).json({ error: 'Invalid session' });
  const user = await userResponse.json();

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const allow = await fetch(`${url}/rest/v1/admin_allowlist?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers });
  if (!allow.ok || (await allow.json()).length === 0) return res.status(403).json({ error: 'Admin access required' });

  async function count(table, filter = '') {
    const r = await fetch(`${url}/rest/v1/${table}?select=id${filter}`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } });
    if (!r.ok) return null;
    const range = r.headers.get('content-range');
    return range ? Number(range.split('/')[1]) || 0 : null;
  }

  async function rows(table, select, filter = '') {
    const r = await fetch(`${url}/rest/v1/${table}?select=${select}${filter}`, { headers: { ...headers, Accept: 'application/json' } });
    if (!r.ok) return [];
    return r.json();
  }

  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
  const startFilter = `&created_at=gte.${encodeURIComponent(start)}`;

  const [drivers, customers, bookings, documents, payments, activeRides, onlineDrivers, verifiedDrivers, pendingDocuments, completedToday, bookingToday, paymentToday, ridesToday] = await Promise.all([
    count('drivers'),
    count('profiles', '&role=eq.customer'),
    count('bookings'),
    count('driver_documents'),
    count('payments'),
    count('rides', '&status=in.(requested,accepted,driver_arriving,in_progress)'),
    count('drivers', '&online=eq.true'),
    count('drivers', '&verified=eq.true'),
    count('driver_documents', '&status=eq.pending'),
    count('rides', `&status=eq.completed${startFilter}`),
    count('bookings', startFilter),
    count('payments', startFilter),
    count('rides', startFilter)
  ]);

  const [todayBookings, todayRides, todayPayments] = await Promise.all([
    rows('bookings', 'estimated_price,vasi_commission,driver_amount', startFilter),
    rows('rides', 'final_fare,estimated_fare,status', startFilter),
    rows('payments', 'amount,status', startFilter)
  ]);
  const sum = (list, field) => list.reduce((n, x) => n + (Number(x[field]) || 0), 0);

  return res.status(200).json({
    drivers, customers, bookings, documents, payments, activeRides, onlineDrivers,
    verifiedDrivers, pendingDocuments, completedToday, bookingToday, paymentToday, ridesToday,
    todayGross: sum(todayBookings, 'estimated_price') || sum(todayRides, 'final_fare'),
    todayCommission: sum(todayBookings, 'vasi_commission'),
    todayDriverAmount: sum(todayBookings, 'driver_amount'),
    todayPaymentsAmount: sum(todayPayments, 'amount')
  });
}
