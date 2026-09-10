import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('professional admin console is accessible and session protected', async () => {
  const [html, app, css, enhancements, login] = await Promise.all([read('admin/index.html'), read('admin/app.js'), read('admin/styles.css'), read('admin/enhancements.css'), read('admin-login.html')]);
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.match(html, /aria-live="polite"/);
  assert.match(app, /auth\.getSession\(\)/);
  assert.match(app, /action:'check_access'/);
  assert.doesNotMatch(app, /vasi_admin_access_token|localStorage\.getItem/);
  for (const endpoint of ['admin-stats','admin-bookings','admin-live-gps','admin-drivers','admin-documents','admin-partners','restaurant-admin','admin-orders','admin-finance','admin-audit','admin-deletions','pricing','support']) assert.match(app, new RegExp(endpoint));
  assert.match(app, /Validation des coursiers/);
  assert.match(app, /required_documents/);
  assert.match(app, /document_links/);
  assert.match(app, /const esc =/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /adminLanguage/);
  assert.match(html, /vasi-languages\.js/);
  assert.match(html, /vasi-account-role\.js/);
  assert.match(login, /VasiAccountRole\.remember\('admin'\)/);
  assert.match(login, /signOut\(\{scope:'local'\}\)/);
  assert.match(app, /activeRole&&activeRole!=='admin'/);
  assert.match(enhancements, /payout-ready/);
  assert.match(app, /RIB vérifié/);
  assert.match(app, /VASI ne stocke jamais l’IBAN complet/);
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

test('VASI Admin installs as a separate secure PWA', async () => {
  const [login, dashboard, installer, manifestSource, worker, vercel] = await Promise.all([
    read('admin-login.html'),
    read('admin/index.html'),
    read('admin-install.js'),
    read('admin-manifest.webmanifest'),
    read('sw.js'),
    read('vercel.json'),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.id, '/admin/');
  assert.equal(manifest.name, 'VASI Admin — Centre d’opérations');
  assert.equal(manifest.short_name, 'VASI Admin');
  assert.equal(manifest.start_url, '/admin/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.match(login, /rel="manifest" href="\/admin-manifest\.webmanifest"/);
  assert.match(dashboard, /rel="manifest" href="\/admin-manifest\.webmanifest"/);
  assert.match(login, /id="installAdmin"/);
  assert.match(login, /admin-install\.js/);
  assert.match(installer, /beforeinstallprompt/);
  assert.match(installer, /appinstalled/);
  assert.match(installer, /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope: "\/" \}\)/);
  assert.match(installer, /ouvrez cette page dans Safari/);
  assert.match(worker, /admin-manifest\.webmanifest/);
  assert.match(worker, /url\.pathname\.startsWith\("\/admin"\)/);
  const config = JSON.parse(vercel);
  assert.ok(config.headers.some(item => item.source === '/admin-manifest.webmanifest'));
});

test('admin password recovery uses a dedicated protected flow', async () => {
  const [login, reset, vercel] = await Promise.all([read('admin-login.html'), read('admin-reset-password.html'), read('vercel.json')]);
  assert.match(login, /resetPasswordForEmail\(email,\{redirectTo:location\.origin\+'\/admin-reset-password'\}\)/);
  assert.match(reset, /event==='PASSWORD_RECOVERY'/);
  assert.match(reset, /isRecoveryLink&&session/);
  assert.match(reset, /auth\.updateUser\(\{password\}\)/);
  assert.match(reset, /password\.length<12/);
  assert.match(reset, /signOut\(\{scope:'local'\}\)/);
  const config = JSON.parse(vercel);
  assert.ok(config.headers.some(item => item.source === '/admin-reset-password.html' && item.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store'))));
  assert.ok(config.headers.some(item => item.source === '/admin-reset-password' && item.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-store'))));
});

test('sensitive admin APIs use the authenticated edge service without a Vercel service-role secret', async () => {
  const helper = await read('api/_admin-service.js');
  assert.match(helper, /Authorization: authorization/);
  assert.match(helper, /functions\/v1\/admin-service/);
  assert.doesNotMatch(helper, /SUPABASE_SERVICE_ROLE_KEY|VASI_SUPABASE_SERVICE_ROLE_KEY/);
  for (const file of ['api/admin-stats.js','api/admin-bookings.js','api/admin-live-gps.js','api/admin-drivers.js','api/admin-documents.js','api/admin-partners.js','api/admin-orders.js','api/admin-finance.js','api/admin-audit.js','api/admin-deletions.js','api/restaurant-admin.js','api/support.js','api/pricing.js']) {
    const source = await read(file);
    assert.match(source, /callAdminService/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|VASI_SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test('edge admin service authorizes every operation and keeps privileged keys server-side', async () => {
  const source = await read('supabase/functions/admin-service/index.ts');
  assert.match(source, /admin_allowlist/);
  assert.match(source, /userClient\.auth\.getUser\(\)/);
  assert.match(source, /SUPABASE_SECRET_KEYS/);
  for (const action of ['stats','list_bookings','update_booking','list_drivers','update_driver','live_gps','list_partners','review_partner','list_documents','review_document','list_restaurants','review_restaurant','list_orders','list_finance','list_audit','list_discounts','create_discount','disable_discount','update_pricing','list_support','update_support','list_deletions','update_deletion']) {
    assert.match(source, new RegExp(`action === '${action}'`));
  }
  assert.match(source, /Only the driver can go online/);
  assert.match(source, /requiredDriverDocuments/);
  assert.match(source, /createSignedUrl\(path, 600\)/);
  assert.match(source, /Pending document not found/);
  assert.match(source, /return json\(\{ error: 'Admin service error' \}, 500\)/);
  assert.match(source, /discount_create/);
});

test('ride registration sends uploaded documents into the protected admin review queue', async () => {
  const register = await read('partner-register-v2.html');
  assert.match(register, /from\('driver_documents'\)\.insert\(documentRows\)/);
  assert.match(register, /driver_id:user\.id,document_type:documentType,file_path:filePath/);
  assert.match(register, /documentType !== 'profile_photo'/);
});
