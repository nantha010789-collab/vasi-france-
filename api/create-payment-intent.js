const supabaseUrl = process.env.VASI_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VASI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const PROMO_END = Date.parse('2026-12-01T00:00:00Z');
const regularCommissionPercent = Number(process.env.VASI_COMMISSION_PERCENT || 20);
const commissionPercent = () => Date.now() < PROMO_END ? 0 : regularCommissionPercent;

async function sb(path, auth, options = {}) {
  return fetch(`${supabaseUrl}${path}`, { ...options, headers: { apikey: anonKey, Authorization: auth, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}
async function stripeAccountReady(accountId){
  const r=await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`,{headers:{Authorization:`Bearer ${stripeKey}`}});
  const account=await r.json();
  if(!r.ok)return {ok:false,error:account?.error?.message||'Could not verify driver payout account'};
  const transfers=account?.capabilities?.transfers;
  const ready=account?.details_submitted===true&&account?.payouts_enabled===true&&transfers==='active';
  return ready?{ok:true,account}:{ok:false,error:'Driver Stripe payout account is not ready to receive transfers'};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabaseUrl || !anonKey || !stripeKey) return res.status(503).json({ error: 'Payment service is not configured' });
  try {
    const rideId = String(req.body?.ride_id || '').trim();
    if (!rideId || rideId.length > 128) return res.status(400).json({ error: 'Valid ride_id required' });
    const rideResp = await sb(`/rest/v1/rides?select=*&id=eq.${encodeURIComponent(rideId)}&limit=1`, auth);
    const rides = await rideResp.json();
    if (!rideResp.ok || !rides?.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rides[0];
    const userResp = await sb('/auth/v1/user', auth, { headers: { apikey: anonKey } });
    const user = await userResp.json();
    if (!user?.id || user.id !== ride.customer_id) return res.status(403).json({ error: 'Ride does not belong to customer' });
    if (!['card','apple_pay'].includes(String(ride.payment_method || '').toLowerCase())) return res.status(409).json({ error: 'This ride is not configured for card payment' });
    if (!['accepted','driver_arriving'].includes(String(ride.status || '').toLowerCase())) return res.status(409).json({ error: 'Card authorization is available only after driver acceptance and before the trip starts' });
    if (!ride.driver_id) return res.status(409).json({ error: 'Driver is not assigned yet' });

    const amount = Math.round(Number(ride.estimated_fare || 0) * 100);
    if (!Number.isFinite(amount) || amount < 50) return res.status(400).json({ error: 'Fare is too low for card payment' });
    const currency = String(ride.currency || 'EUR').toLowerCase();

    const priorResp = await sb(`/rest/v1/payments?select=id,provider_payment_id,status,amount,currency,created_at&ride_id=eq.${encodeURIComponent(ride.id)}&provider=eq.stripe&order=created_at.desc&limit=100`, auth);
    const priorRows = priorResp.ok ? (await priorResp.json()) || [] : [];
    const prior = priorRows[0] || null;
    if (prior?.provider_payment_id) {
      const existingIntentResp = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(prior.provider_payment_id)}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
      const existingIntent = await existingIntentResp.json();
      if (existingIntentResp.ok && existingIntent?.client_secret && !['canceled','succeeded'].includes(existingIntent.status)) {
        const sameAmount = Number(existingIntent.amount) === amount;
        const sameCurrency = String(existingIntent.currency || '').toLowerCase() === currency;
        if (sameAmount && sameCurrency) {
          return res.status(200).json({ payment_intent_id: existingIntent.id, client_secret: existingIntent.client_secret, amount: amount / 100, currency: currency.toUpperCase(), reused: true });
        }
        const cancelResp = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(existingIntent.id)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!cancelResp.ok) return res.status(409).json({ error: 'Existing card authorization no longer matches the current fare. Please retry payment authorization.' });
        if (prior.id) await sb(`/rest/v1/payments?id=eq.${encodeURIComponent(prior.id)}`, auth, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled' }) }).catch(() => null);
      }
    }

    const driverResp = await sb(`/rest/v1/drivers?select=stripe_account_id&id=eq.${encodeURIComponent(ride.driver_id)}&limit=1`, auth);
    const drivers = await driverResp.json();
    const stripeAccount = drivers?.[0]?.stripe_account_id;
    if (!stripeAccount) return res.status(409).json({ error: 'Driver Stripe payout account is not onboarded yet' });
    const readiness=await stripeAccountReady(stripeAccount);
    if(!readiness.ok)return res.status(409).json({error:readiness.error});
    const fee = Math.max(0, Math.min(amount - 1, Math.round(amount * commissionPercent() / 100)));
    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('currency', currency);
    params.set('capture_method', 'manual');
    params.set('payment_method_types[0]', 'card');
    params.set('description', `VASI ride ${ride.id}`);
    params.set('metadata[ride_id]', ride.id);
    params.set('metadata[customer_id]', ride.customer_id);
    params.set('metadata[driver_id]', ride.driver_id);
    if (fee > 0) params.set('application_fee_amount', String(fee));
    params.set('transfer_data[destination]', stripeAccount);
    const attempt = priorRows.length + 1;
    const stripeResp = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `vasi-ride-auth-${ride.id}-${amount}-${attempt}` }, body: params });
    const pi = await stripeResp.json();
    if (!stripeResp.ok) return res.status(stripeResp.status).json({ error: pi?.error?.message || 'Stripe payment intent failed' });
    const existingResp = await sb(`/rest/v1/payments?select=id&provider_payment_id=eq.${encodeURIComponent(pi.id)}&limit=1`, auth);
    const existing = existingResp.ok ? await existingResp.json() : [];
    if (!existing?.length) {
      const pay = await sb('/rest/v1/payments', auth, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ride_id: ride.id, customer_id: ride.customer_id, amount: amount / 100, currency: currency.toUpperCase(), provider: 'stripe', provider_payment_id: pi.id, status: 'pending' }) });
      if (!pay.ok) return res.status(500).json({ error: 'Payment intent created but payment record could not be saved' });
    }
    return res.status(200).json({ payment_intent_id: pi.id, client_secret: pi.client_secret, amount: amount / 100, currency: currency.toUpperCase(), commission_percent: commissionPercent(), reused: false });
  } catch (e) { return res.status(500).json({ error: e?.message || 'Server error' }); }
}
