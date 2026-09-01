const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';

const PRICING = {
  'VASI Go': { base: 2.50, km: 0.95, min: 0.20, minFare: 7.50 },
  'VASI Comfort': { base: 3.20, km: 1.10, min: 0.23, minFare: 9.50 },
  'VASI XL': { base: 4.00, km: 1.25, min: 0.25, minFare: 12.00 },
  'VASI Van': { base: 5.00, km: 1.40, min: 0.28, minFare: 15.00 }
};
const PAYMENT_METHODS = new Set(['cash', 'card', 'apple_pay']);

function finiteCoord(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function fareFor(service, km, mins) {
  const p = PRICING[service];
  const raw = p.base + km * p.km + mins * p.min;
  return Number(Math.max(p.minFare, raw).toFixed(2));
}
async function routeMetrics(pickupLat, pickupLng, destinationLat, destinationLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${destinationLng},${destinationLat}?overview=false`;
  const response = await fetch(url, { headers: { 'User-Agent': 'VASI/1.0' } });
  if (!response.ok) throw new Error('Route pricing service unavailable');
  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error('Could not price this route');
  return { km: route.distance / 1000, mins: Math.ceil(route.duration / 60) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const b = req.body || {};
    const service = String(b.service || 'VASI Go');
    if (!PRICING[service]) return res.status(400).json({ error: 'Unsupported VASI ride service' });
    const paymentMethod = String(b.payment_method || 'cash').toLowerCase();
    if (!PAYMENT_METHODS.has(paymentMethod)) return res.status(400).json({ error: 'Unsupported payment method' });

    const pickupLat = finiteCoord(b.pickup_lat, -90, 90);
    const pickupLng = finiteCoord(b.pickup_lng, -180, 180);
    const destinationLat = finiteCoord(b.destination_lat, -90, 90);
    const destinationLng = finiteCoord(b.destination_lng, -180, 180);
    if ([pickupLat, pickupLng, destinationLat, destinationLng].some(v => v === null)) {
      return res.status(400).json({ error: 'Valid pickup and destination coordinates are required' });
    }
    if (!String(b.pickup_address || '').trim() || !String(b.destination_address || '').trim()) {
      return res.status(400).json({ error: 'Pickup and destination are required' });
    }

    const metrics = await routeMetrics(pickupLat, pickupLng, destinationLat, destinationLng);
    const authoritativeFare = fareFor(service, metrics.km, metrics.mins);
    const headers = { apikey: anonKey, Authorization: auth, 'Content-Type': 'application/json' };
    const create = await fetch(`${supabaseUrl}/rest/v1/rpc/create_customer_ride`, {
      method: 'POST', headers,
      body: JSON.stringify({
        p_pickup_address: String(b.pickup_address).trim(),
        p_pickup_lat: pickupLat,
        p_pickup_lng: pickupLng,
        p_destination_address: String(b.destination_address).trim(),
        p_destination_lat: destinationLat,
        p_destination_lng: destinationLng,
        p_service: service,
        p_payment_method: paymentMethod,
        p_estimated_fare: authoritativeFare,
        p_currency: 'EUR',
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

    const dispatch = await fetch(`${supabaseUrl}/rest/v1/rpc/vasi_dispatch_ride`, {
      method: 'POST', headers, body: JSON.stringify({ p_ride_id: ride.id })
    });
    const dispatched = await dispatch.json();
    return res.status(201).json({
      ride,
      pricing: { distance_km: Number(metrics.km.toFixed(2)), duration_min: metrics.mins, estimated_fare: authoritativeFare, currency: 'EUR' },
      offers_sent: dispatch.ok ? Number(dispatched || 0) : 0,
      dispatch_error: dispatch.ok ? null : (dispatched?.message || dispatched?.error || 'Dispatch unavailable')
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
