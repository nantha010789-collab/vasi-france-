import { callAdminService, parseBody } from './_admin-service.js';

const supabaseUrl =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://vhfyvkrvysrooaqzcxsp.supabase.co';
const publishableKey =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';

const fallback = {
  offer_active: true, offer_name: 'VASI offer price', starts_at: null, ends_at: null,
  offer_mode: 'fixed', discount_percent: 10, max_discount_eur: null,
  minimum_regular_fare: null, go_base: 1.5, go_per_km: 0.68,
  go_per_minute: 0.14, go_minimum: 7.5, comfort_base: 2,
  comfort_per_km: 0.78, comfort_per_minute: 0.16, comfort_minimum: 9,
  xl_base: 2.8, xl_per_km: 0.95, xl_per_minute: 0.18, xl_minimum: 11.5,
  van_base: 3.5, van_per_km: 1.05, van_per_minute: 0.2, van_minimum: 13.5,
};

function publicShape(row) {
  const now = Date.now();
  const starts = row.starts_at ? Date.parse(row.starts_at) : null;
  const ends = row.ends_at ? Date.parse(row.ends_at) : null;
  const classes = {};
  for (const name of ['go', 'comfort', 'xl', 'van']) {
    classes[name] = {
      base: Number(row[name + '_base']),
      km: Number(row[name + '_per_km']),
      min: Number(row[name + '_per_minute']),
      minFare: Number(row[name + '_minimum']),
    };
  }
  return {
    offer_active: Boolean(row.offer_active) && (!starts || now >= starts) && (!ends || now < ends),
    offer_enabled: Boolean(row.offer_active),
    offer_name: row.offer_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    offer_mode: row.offer_mode === 'percentage' ? 'percentage' : 'fixed',
    discount_percent: Number(row.discount_percent || 0),
    max_discount_eur: row.max_discount_eur == null ? null : Number(row.max_discount_eur),
    minimum_regular_fare: row.minimum_regular_fare == null ? null : Number(row.minimum_regular_fare),
    classes,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'PATCH') {
    const result = await callAdminService(req, 'update_pricing', parseBody(req));
    return res.status(result.status).json(result.data.pricing || result.data);
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET or PATCH required' });

  const authorization = req.headers.authorization || `Bearer ${publishableKey}`;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/vasi_pricing_settings?id=eq.active&select=*`, {
      headers: { apikey: publishableKey, Authorization: authorization },
    });
    const rows = await response.json();
    if (!response.ok) throw new Error(rows?.message || 'Pricing unavailable');
    return res.status(200).json(publicShape(rows?.[0] || fallback));
  } catch {
    return res.status(200).json(publicShape(fallback));
  }
}
