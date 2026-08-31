const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const b = req.body || {};
    const headers = { apikey: anonKey, Authorization: auth, 'Content-Type': 'application/json' };
    const create = await fetch(`${supabaseUrl}/rest/v1/rpc/create_customer_ride`, {
      method: 'POST', headers,
      body: JSON.stringify({
        p_pickup_address: b.pickup_address,
        p_pickup_lat: b.pickup_lat ?? null,
        p_pickup_lng: b.pickup_lng ?? null,
        p_destination_address: b.destination_address,
        p_destination_lat: b.destination_lat ?? null,
        p_destination_lng: b.destination_lng ?? null,
        p_service: b.service || 'VASI Go',
        p_payment_method: b.payment_method || 'cash',
        p_estimated_fare: Number(b.estimated_fare || 0),
        p_currency: b.currency || 'EUR',
        p_scheduled_for: b.scheduled_for || null,
        p_passenger_name: b.passenger_name || null,
        p_passenger_phone: b.passenger_phone || null,
        p_notes: b.notes || null
      })
    });
    const created = await create.json();
    if (!create.ok) return res.status(create.status).json({ error: created?.message || created?.error || 'Could not create ride' });
    const ride = Array.isArray(created) ? created[0] : created;
    if (!ride?.id) return res.status(500).json({ error: 'Ride was not created' });

    const assign = await fetch(`${supabaseUrl}/rest/v1/rpc/assign_nearest_driver`, {
      method: 'POST', headers, body: JSON.stringify({ p_ride_id: ride.id })
    });
    const assigned = await assign.json();
    if (!assign.ok) return res.status(200).json({ ride, assignment_error: assigned?.message || assigned?.error || 'No driver assigned' });
    return res.status(201).json({ ride: Array.isArray(assigned) ? assigned[0] : assigned });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
