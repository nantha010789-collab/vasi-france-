import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import '../assets/ride-fare-guard.js';
const guard = globalThis.VasiRideFareGuard;

test('12% commission protects €9 without changing a sufficient old tariff', () => {
  assert.equal(guard(7.5, 12, 1), 10.23);
  assert.equal(guard(11.8, 12, 10), 11.8);
});

test('offers cannot erode ride or estimated-distance driver floors', () => {
  for (const commission of [0, 10, 12, 15, 50]) {
    for (const km of [1, 7.9, 10, 20, 100]) {
      const fare = guard(7.5 * 0.85, commission, km);
      const customer = Math.round(fare * 100);
      const driver = customer - Math.round(customer * commission / 100);
      assert.ok(driver >= Math.max(900, Math.ceil(km * 100)));
    }
  }
});

test('same shared guard runs in browser and server', () => {
  const code = readFileSync(new URL('../assets/ride-fare-guard.js', import.meta.url), 'utf8');
  const browser = {};
  runInNewContext(code, browser);
  assert.equal(browser.VasiRideFareGuard(6, 12, 1), guard(6, 12, 1));
  const ui = readFileSync(new URL('../ride-flow.html', import.meta.url), 'utf8');
  assert.match(ui, /assets\/ride-fare-guard\.js/);
  assert.match(ui, /VasiRideFareGuard\(unprotectedPriceFor/);
});

test('invalid pricing never returns an unprotected fare', () => {
  assert.throws(() => guard(NaN), RangeError);
  assert.throws(() => guard(10, 100), RangeError);
  assert.throws(() => guard(10, 12, -1), RangeError);
});
