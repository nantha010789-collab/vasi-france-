import { createHash } from 'node:crypto';
import { callAdminService } from './_admin-service.js';

const SERVICE = 'vasi_cash_commission_test';
const AMOUNT = 1200;
const RETURN_URL = 'https://www.vasigo.eu/admin/cash-test.html';
const id = value => typeof value === 'string' ? value : value?.id;
const fault = (message, status = 400) => Object.assign(new Error(message), { status });

// A separate Stripe-test fixture. Never reads or settles production cash debts.
export function createCashTestHandler({ key, authorize, stripe }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'GET or POST required' });
    if (!req.headers.authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      const admin = await authorize(req);
      if (!admin?.email) throw fault('Administrator access required', 403);
      // Fail closed if a live key is ever configured. Do not expose key values.
      if (!/^(sk|rk)_test_/.test(key || '')) throw fault('Stripe TEST key required. Live payments are blocked.', 503);
      const owner = createHash('sha256').update(admin.email.toLowerCase()).digest('hex');
      const owned = object => object?.livemode === false && object.metadata?.service === SERVICE && object.metadata?.owner === owner;
      let body = req.body || {};
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw fault('Invalid JSON'); } }
      const action = req.method === 'GET' ? 'status' : body.action;
      const sessionId = req.method === 'GET' ? req.query?.session : body.session;
      if (action === 'status' && !sessionId) return res.status(200).json({ test_mode: true, fixture_amount: 12, currency: 'EUR', status: 'ready' });
      if (action === 'setup') {
        if (!/^[a-zA-Z0-9-]{16,80}$/.test(body.request_id || '')) throw fault('A unique test request ID is required');
        const meta = { 'metadata[service]': SERVICE, 'metadata[owner]': owner };
        const customer = await stripe('POST', '/v1/customers', { name: 'VASI fictional driver — TEST', ...meta }, `cash-test-customer-${owner}-${body.request_id}`);
        if (!owned(customer)) throw fault('Stripe test customer mismatch', 409);
        const session = await stripe('POST', '/v1/checkout/sessions', {
          mode: 'setup', currency: 'eur', customer: customer.id,
          'payment_method_types[]': 'sepa_debit', ...meta,
          'setup_intent_data[metadata][service]': SERVICE,
          'setup_intent_data[metadata][owner]': owner,
          success_url: `${RETURN_URL}?setup_session={CHECKOUT_SESSION_ID}`,
          cancel_url: `${RETURN_URL}?cancelled=1`,
          'custom_text[submit][message]': 'TEST uniquement : après autorisation du mandat, un prélèvement fictif de 12 EUR sera lancé. Aucun solde chauffeur réel ne sera modifié.',
        }, `cash-test-setup-${owner}-${body.request_id}`);
        if (!owned(session) || !session.url?.startsWith('https://checkout.stripe.com/')) throw fault('Invalid Stripe test checkout', 409);
        return res.status(200).json({ test_mode: true, url: session.url, session: session.id });
      }
      if (!['status', 'collect'].includes(action)) throw fault('Unsupported action');
      if (!/^cs_test_[a-zA-Z0-9_]+$/.test(sessionId || '')) throw fault('A Stripe TEST setup session is required');
      const session = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (!owned(session) || session.mode !== 'setup') throw fault('Test session access denied', 403);
      const customerId = id(session.customer);
      const customer = await stripe('GET', `/v1/customers/${encodeURIComponent(customerId)}`);
      if (!owned(customer)) throw fault('Test customer access denied', 403);
      if (session.status !== 'complete' || !id(session.setup_intent)) {
        if (action === 'collect') throw fault('Complete the test mandate first', 409);
        return res.status(200).json({ test_mode: true, status: 'mandate_required', fixture_amount: 12, remaining: 12, settled: 0 });
      }
      const setup = await stripe('GET', `/v1/setup_intents/${encodeURIComponent(id(session.setup_intent))}`);
      if (!owned(setup) || setup.status !== 'succeeded' || id(setup.customer) !== customerId || !id(setup.mandate) || !id(setup.payment_method)) throw fault('A verified test mandate is required', 409);
      const mandate = await stripe('GET', `/v1/mandates/${encodeURIComponent(id(setup.mandate))}`);
      if (mandate.livemode !== false || id(mandate.payment_method) !== id(setup.payment_method)) throw fault('Mandate mismatch', 409);
      const payments = await stripe('GET', `/v1/payment_intents?customer=${encodeURIComponent(customerId)}&limit=1&expand[]=data.latest_charge`);
      let payment = payments.data?.[0];
      if (payment && (!owned(payment) || payment.metadata?.setup_session !== sessionId || payment.amount !== AMOUNT || payment.currency !== 'eur' || id(payment.customer) !== customerId)) throw fault('Test payment mismatch', 409);
      if (!payment && action === 'collect') {
        if (mandate.status !== 'active') throw fault('Test mandate is no longer active', 409);
        payment = await stripe('POST', '/v1/payment_intents', {
          amount: String(AMOUNT), currency: 'eur', customer: customerId,
          payment_method: id(setup.payment_method), mandate: mandate.id,
          'payment_method_types[]': 'sepa_debit', confirm: 'true', off_session: 'true',
          'metadata[service]': SERVICE, 'metadata[owner]': owner, 'metadata[setup_session]': sessionId,
          description: 'VASI TEST — fictional cash commission, no production debt',
          'expand[]': 'latest_charge',
        }, `cash-test-collect-${sessionId}`);
      }
      // Retrieve provider state on every read. Redirects/processing never clear debt.
      if (payment && (!owned(payment) || payment.amount !== AMOUNT || payment.currency !== 'eur' || id(payment.customer) !== customerId || payment.metadata?.setup_session !== sessionId)) throw fault('Stripe test payment mismatch', 409);
      const charge = typeof payment?.latest_charge === 'object' ? payment.latest_charge : null;
      const received = payment?.status === 'succeeded' && charge && !charge.disputed
        ? Math.max(0, Math.min(AMOUNT, Number(payment.amount_received || 0)) - Number(charge?.amount_refunded || 0)) : 0;
      return res.status(200).json({ test_mode: true, fixture_amount: 12, currency: 'EUR', status: payment?.status || 'mandate_ready', mandate_status: mandate.status, payment_id: payment?.id || null, settled: received / 100, remaining: (AMOUNT - received) / 100 });
    } catch (error) {
      return res.status(Number(error.status) || 502).json({ error: error.message || 'Test service unavailable' });
    }
  };
}

async function stripeRequest(method, path, params, idempotencyKey) {
  const headers = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2025-07-30.basil' };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers, ...(params ? { body: new URLSearchParams(params).toString() } : {}), signal: AbortSignal.timeout(18000) });
  const data = await response.json();
  if (!response.ok) throw fault(data?.error?.message || 'Stripe test request failed', response.status);
  return data;
}

export default async function handler(req, res) {
  return createCashTestHandler({
    key: process.env.STRIPE_SECRET_KEY,
    authorize: async request => {
      const result = await callAdminService(request, 'check_access');
      if (result.status !== 200) throw fault('Administrator access required', result.status);
      return { email: result.data.admin_email };
    },
    stripe: stripeRequest,
  })(req, res);
}
