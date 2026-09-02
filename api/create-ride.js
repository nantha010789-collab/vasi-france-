const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';

const PROMO_END = Date.parse('2026-12-01T00:00:00Z');
const REGULAR_PRICING = {
  'VASI Go': { base: 2.50, km: 0.95, min: 0.20, minFare: 9.50 },
  'VASI Comfort': { base: 3.20, km: 1.10, min: 0.23, minFare: 10.50 },
  'VASI XL': { base: 4.00, km: 1.25, min: 0.25, minFare: 13.00 },
  'VASI Van': { base: 5.00, km: 1.40, min: 0.28, minFare: 16.00 }
};
const PROMO_PRICING = {
  'VASI Go': { base: 1.50, km: 0.68, min: 0.14, minFare: 7.50 },
  'VASI Comfort': { base: 2.00, km: 0.78, min: 0.16, minFare: 9.00 },
  'VASI XL': { base: 2.80, km: 0.95, min: 0.18, minFare: 11.50 },
  'VASI Van': { base: 3.50, km: 1.05, min: 0.20, minFare: 13.50 }
};
const activePricing = () => Date.now() < PROMO_END ? PROMO_PRICING : REGULAR_PRICING;
const PAYMENT_METHODS = new Set(['cash', 'card', 'apple_pay']);

function finiteCoord(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function fareFor(service, km, mins) {
  const p = activePricing()[service];
  const raw = p.base + km * p.km + mins * p.min;
  return Number(Math.max(p.minFare, raw).toFixed(2));
}
function normalizeSchedule(value) {
  if (value === null || value === undefined || value === '') return null;
  const when = new Date(value);
  if (!Number.isFinite(when.getTime())) throw new Error('Invalid scheduled pickup time');
  const now = Date.now();
  if (when.getTime() < now + 30 * 60 * 1000) throw new Error('Scheduled pickup must be at least 30 minutes from now');
  if (when.getTime() > now + 90 * 24 * 60 * 60 * 1000) throw new Error('Scheduled pickup must be within 90 days');
  return when.toISOString();
}
async function geocodeStop(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr,gb,be,de,nl,lu,ch,es,it,pt&addressdetails=0&q=${encodeURIComponent(address)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'VASI/1.0 (ride-booking)' } });
  if (!response.ok) throw new Error(`Could not locate stop: ${address}`);
  const data = await response.json();
  const hit = data?.[0];
  const lat = finiteCoord(hit?.lat, -90, 90);
  const lng = finiteCoord(hit?.lon, -180, 180);
  if (lat === null || lng === null) throw new Error(`Could not locate stop: ${address}`);
  return { address, lat, lng };
}
async function routeMetrics(points) {
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
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
    if (!activePricing()[service]) return res.status(400).json({ error: 'Unsupported VASI ride service' });
    const paymentMethod = String(b.payment_method || 'cash').toLowerCase();
    if (!PAYMENT_METHODS.has(paymentMethod)) return res.status(400).json({ error: 'Unsupported payment method' });
    const scheduledFor = normalizeSchedule(b.scheduled_for);

    const pickupLat = finiteCoord(b.pickup_lat, -90, 90);
    const pickupLng = finiteCoord(b.pickup_lng, -180, 180);
    const destinationLat = finiteCoord(b.destination_lat, -90, 90);
    const destinationLng = finiteCoord(b.destination_lng, -180, 180);
    if ([pickupLat, pickupLng, destinationLat, destinationLng].some(v => v === null)) {
      return res.status(400).json({ error: 'Valid pickup and destination coordinates are required' });
    }
    const pickupAddress = String(b.pickup_address || '').trim();
    const destinationAddress = String(b.destination_address || '').trim();
    if (!pickupAddress || !destinationAddress) return res.status(400).json({ error: 'Pickup and destination are required' });

    const stopAddresses = Array.isArray(b.stops) ? b.stops.map(x => String(x || '').trim()).filter(Boolean) : [];
    if (stopAddresses.length > 5) return res.status(400).json({ error: 'Maximum 5 extra stops allowed' });
    if (stopAddresses.some(x => x.length > 200)) return res.status(400).json({ error: 'Stop address is too long' });
    const stops = [];
    for (const address of stopAddresses) stops.push(await geocodeStop(address));

    const points = [
      { lat: pickupLat, lng: pickupLng },
      ...stops,
      { lat: destinationLat, lng: destinationLng }
    ];
    const metrics = await routeMetrics(points);
    const authoritativeFare = fareFor(service, metrics.km, metrics.mins);
    const headers = { apikey: anonKey, Authorization: auth, 'Content-Type': 'application/json' };
    const create = await fetch(`${supabaseUrl}/rest/v1/rpc/create_customer_ride`, {
      method: 'POST', headers,
      body: JSON.stringify({
        p_pickup_address: pickupAddress,
        p_pickup_lat: pickupLat,
        p_pickup_lng: pickupLng,
        p_destination_address: destinationAddress,
        p_destination_lat: destinationLat,
        p_destination_lng: destinationLng,
        p_service: service,
        p_payment_method: paymentMethod,
        p_estimated_fare: authoritativeFare,
        p_currency: 'EUR',
        p_scheduled_for: scheduledFor,
        p_passenger_name: b.passenger_name || null,
        p_passenger_phone: b.passenger_phone || null,
        p_notes: b.notes || null
      })
    });
    const created = await create.json();
    if (!create.ok) return res.status(create.status).json({ error: created?.message || created?.error || 'Could not create ride' });
    const ride = Array.isArray(created) ? created[0] : created;
    if (!ride?.id) return res.status(500).json({ error: 'Ride was not created' });

    if (stops.length) {
      const stopRows = stops.map((s, i) => ({ ride_id: ride.id, stop_order: i + 1, address: s.address, latitude: s.lat, longitude: s.lng }));
      const saveStops = await fetch(`${supabaseUrl}/rest/v1/ride_stops`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(stopRows)
      });
      if (!saveStops.ok) {
        await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${encodeURIComponent(ride.id)}`, { method: 'DELETE', headers });
        return res.status(500).json({ error: 'Ride stops could not be saved. Please try again.' });
      }
    }

    const dispatch = await fetch(`${supabaseUrl}/rest/v1/rpc/vasi_dispatch_ride`, {
      method: 'POST', headers, body: JSON.stringify({ p_ride_id: ride.id })
    });
    const dispatched = await dispatch.json();
    return res.status(201).json({
      ride: { ...ride, estimated_fare: authoritativeFare },
      stops: stops.map((s, i) => ({ order: i + 1, address: s.address, latitude: s.lat, longitude: s.lng })),
      pricing: { distance_km: Number(metrics.km.toFixed(2)), duration_min: metrics.mins, estimated_fare: authoritativeFare, currency: 'EUR', promotion: Date.now() < PROMO_END ? 'VASI launch price' : null, promotion_ends_at: Date.now() < PROMO_END ? new Date(PROMO_END).toISOString() : null },
      reservation: scheduledFor ? { scheduled_for: scheduledFor, mode: 'reserve' } : null,
      offers_sent: dispatch.ok ? Number(dispatched || 0) : 0,
      dispatch_error: dispatch.ok ? null : (dispatched?.message || dispatched?.error || 'Dispatch unavailable')
    });
  } catch (e) {
    const message = e?.message || 'Server error';
    const badRequest = /scheduled pickup|invalid scheduled/i.test(message);
    return res.status(badRequest ? 400 : 500).json({ error: message });
  }
}
