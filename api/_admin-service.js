const SUPABASE_URL =
  process.env.VASI_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://vhfyvkrvysrooaqzcxsp.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  process.env.VASI_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_mypiW8lczhmoQb4rECuE8Q_dEhNiCKT';

export async function callAdminService(req, action, payload = {}) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return { status: 401, data: { error: 'Authentication required' } };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-service`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, action }),
    });
    const data = await response.json().catch(() => ({ error: 'Invalid admin service response' }));
    return { status: response.status, data };
  } catch (error) {
    console.error('[admin-service] request failed', { action, error: String(error) });
    return { status: 502, data: { error: 'Admin service temporarily unavailable' } };
  }
}

export function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

export function sendAdminResult(res, result, key) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  if (result.status < 200 || result.status >= 300) return res.status(result.status).json(result.data);
  return res.status(result.status).json(key ? result.data[key] : result.data);
}
