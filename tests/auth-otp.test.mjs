import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../auth.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*(const SUPABASE_URL[\s\S]*?)<\/script>/)[1];
const source = script.slice(0, script.lastIndexOf('      render();\n      restorePendingOtp();'));
function harness({ auth = {}, search = '?role=customer&method=email', language = 'fr', stored = {} } = {}) {
  const elements = new Map();
  const storage = new Map(Object.entries(stored));
  const ticks = [];
  const node = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { value: '', textContent: '', disabled: false,
        focus() {}, setAttribute() {}, checkValidity() { return this.value.includes('@'); },
        classList: { add: x => classes.add(x), remove: x => classes.delete(x),
          toggle(x, force) { force ? classes.add(x) : classes.delete(x); },
          contains: x => classes.has(x) } });
    }
    return elements.get(id);
  };
  const sessionStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const context = { URLSearchParams, URL, Date, localStorage: sessionStorage, sessionStorage,
    location: { search, pathname: '/auth.html', origin: 'https://www.vasigo.eu', href: 'https://www.vasigo.eu/auth.html' + search },
    history: { replaceState() {} }, document: { getElementById: node, querySelector: node },
    window: { localStorage: sessionStorage, VasiLanguage: { translate: x => x, getLanguage: () => language } },
    VasiRegion: { getRegion: () => ({ phonePlaceholder: '+33612345678', shortName: 'France' }), normalizePhone: x => x },
    VasiAccountRole: { scoped: () => ({ active: () => '', intent: () => '', setIntent() {} }) },
    supabase: { createClient: () => ({ auth }) },
    setInterval(fn) { ticks.push(fn); return ticks.length; }, clearInterval() {} };
  runInNewContext(source, context);
  runInNewContext('render(); routeSession = async session => { window.routedSession = session; };', context);
  return { node, storage, ticks, run: code => runInNewContext(code, context), context };
}

test('email OTP sends normalized identity, displays code form and verifies a session', async () => {
  const calls = [];
  const h = harness({ auth: {
    async signInWithOtp(args) { calls.push(args); return { error: null }; },
    async verifyOtp(args) { calls.push(args); return { data: { session: { user: { id: 'customer' } } }, error: null }; },
  } });
  h.node('identity').value = ' TEST@EXAMPLE.COM ';
  await h.run('submitAuth()');
  assert.equal(calls[0].email, 'test@example.com');
  assert.equal(calls[0].options.shouldCreateUser, true);
  assert.equal(h.node('codeStep').classList.contains('hidden'), false);
  assert.equal(h.node('identity').disabled, true);
  assert.match(h.node('msg').textContent, /Code envoyé/);
  h.node('otp').value = '123456';
  await h.run('submitAuth()');
  assert.equal(calls[1].type, 'email');
  assert.equal(calls[1].token, '123456');
  assert.equal(h.context.window.routedSession.user.id, 'customer');
  assert.equal(h.storage.has('vasi_pending_otp_customer_customer'), false);
});

test('pending requests prevent method changes and duplicate email sends; network failure releases controls', async () => {
  let reject;
  let count = 0;
  const h = harness({ auth: { signInWithOtp() { count++; return new Promise((_, r) => { reject = r; }); } } });
  h.node('identity').value = 'test@example.com';
  const first = h.run('submitAuth()');
  h.run("setAuthMethod('phone')");
  await h.run('submitAuth()');
  assert.equal(h.run('authMethod'), 'email');
  assert.equal(count, 1);
  reject(new Error('Network unavailable'));
  await first;
  assert.equal(h.node('continueBtn').disabled, false);
  assert.equal(h.run('sendingCode'), false);
  assert.match(h.node('msg').textContent, /momentanément indisponible/);
});

test('email resend respects cooldown, clears old code and keeps the email channel', async () => {
  let sends = 0;
  const h = harness({ auth: { async signInWithOtp() { sends++; return { error: null }; } } });
  h.node('identity').value = 'test@example.com';
  await h.run('submitAuth()');
  await h.run('resendCode()');
  assert.equal(sends, 1);
  h.run('startResendCountdown(0)');
  h.node('otp').value = '111111';
  await h.run('resendCode()');
  assert.equal(sends, 2);
  assert.equal(h.node('otp').value, '');
  assert.equal(h.run('resendSeconds'), 90);
  assert.match(h.node('msg').textContent, /Nouveau code e-mail/);
});

test('invalid email OTP stays unsigned in and permits recovery without exposing a session', async () => {
  let verifies = 0;
  const h = harness({ auth: {
    async signInWithOtp() { return { error: null }; },
    async verifyOtp() { verifies++; return { data: {}, error: { code: 'otp_expired', message: 'expired' } }; },
  } });
  h.node('identity').value = 'test@example.com';
  await h.run('submitAuth()');
  h.node('otp').value = '123';
  await h.run('submitAuth()');
  assert.equal(verifies, 0);
  h.node('otp').value = '123456';
  await h.run('submitAuth()');
  assert.equal(h.context.window.routedSession, undefined);
  assert.equal(h.node('otp').value, '');
  assert.equal(h.node('resendBtn').disabled, false);
  assert.match(h.node('msg').textContent, /expiré/);
});

test('email delivery rate limit blocks repeated initial submissions until cooldown expires', async () => {
  let sends = 0;
  const h = harness({ auth: { async signInWithOtp() { sends++; return { error: { message: 'email rate limit' } }; } } });
  h.node('identity').value = 'test@example.com';
  await h.run('submitAuth()');
  await h.run('submitAuth()');
  assert.equal(sends, 1);
  assert.equal(h.node('continueBtn').disabled, true);
  h.run('startResendCountdown(0)');
  assert.equal(h.node('continueBtn').disabled, false);
});

test('restored email codes are scoped to customer and driver login surfaces', () => {
  const stored = { vasi_pending_otp_customer_customer: JSON.stringify({ method: 'email', identity: 'customer@example.com', createdAt: Date.now(), readyAt: Date.now() + 90_000 }) };
  const customer = harness({ stored });
  customer.run('restorePendingOtp()');
  assert.equal(customer.node('identity').value, 'customer@example.com');
  const driver = harness({ stored, search: '?role=ride&surface=driver&method=email' });
  driver.run('restorePendingOtp()');
  assert.equal(driver.node('identity').value, '');
});
