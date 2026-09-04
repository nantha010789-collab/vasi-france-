import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('professional admin console is accessible and session protected', async () => {
  const [html, app, css] = await Promise.all([read('admin/index.html'), read('admin/app.js'), read('admin/styles.css')]);
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.match(html, /aria-live="polite"/);
  assert.match(app, /auth\.getSession\(\)/);
  assert.match(app, /action:'check_access'/);
  assert.doesNotMatch(app, /vasi_admin_access_token|localStorage\.getItem/);
  for (const endpoint of ['admin-stats','admin-bookings','admin-live-gps','admin-drivers','admin-documents','restaurant-admin','pricing','support']) assert.match(app, new RegExp(endpoint));
  assert.match(app, /const esc =/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('admin routing stays on Vercel and old dashboard is retired', async () => {
  const [login, legacy, vercel] = await Promise.all([read('admin-login.html'), read('vasi-admin.html'), read('vercel.json')]);
  assert.match(login, /endsWith\('\.github\.io'\)/);
  assert.match(login, /vasi-new\.vercel\.app\/admin-login\.html/);
  assert.match(login, /location\.replace\('admin\/'\)/);
  assert.match(legacy, /location\.replace\('admin\/'\)/);
  const config = JSON.parse(vercel);
  assert.ok(config.rewrites.some(item => item.source === '/admin'));
  assert.ok(config.headers.some(item => item.source === '/admin/(.*)'));
});

test('sensitive admin APIs enforce server-side allowlist', async () => {
  for (const file of ['api/restaurant-admin.js','api/support.js','api/pricing.js']) {
    const source = await read(file);
    assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(source, /admin_allowlist/);
    assert.match(source, /Admin access required/);
  }
});
