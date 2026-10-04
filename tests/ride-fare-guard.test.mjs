import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import '../assets/ride-fare-guard.js';
const guard = globalThis.VasiRideFareGuard;
const fundedQuote = globalThis.VasiFundedRideQuote;

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
      assert.ok(driver >= Math.max(900, Math.ceil(km * 101)));
    }
  }
});

test('VASI funds customer offers without reducing driver pay', () => {
  const welcome = fundedQuote(7.5, 12, 1, 15, 6);
  assert.deepEqual(welcome, {
    settlement_fare: 10.23,
    customer_fare: 9,
    customer_discount: 1.23,
    platform_funded_discount: 1.23,
    gross_vasi_commission: 1.23,
    vasi_commission: 0,
    driver_amount: 9,
  });
  const loyalty = fundedQuote(7.5, 12, 1, 10, 6);
  assert.equal(loyalty.customer_fare, 9.21);
  assert.equal(loyalty.driver_amount, 9);
  assert.equal(loyalty.vasi_commission, 0.21);
  assert.equal(loyalty.customer_fare, loyalty.driver_amount + loyalty.vasi_commission);
});

test('funded offer never exceeds VASI gross commission', () => {
  const quote = fundedQuote(25, 12, 10, 50, 100);
  assert.equal(quote.customer_discount, quote.gross_vasi_commission);
  assert.equal(quote.vasi_commission, 0);
  assert.equal(quote.customer_fare, quote.driver_amount);
});

// Synthetic scenarios: short/long rides and traffic, not competitor quotes.
for (const [km, minutes] of [[0.5,3],[1,5],[2,8],[3,10],[4,12],
  [5,15],[7.9,25],[8,40],[10,20],[10,60],[12,30],[15,35],
  [20,45],[25,55],[30,60],[40,80],[50,100],[75,120],[100,150],[200,240]]) {
  test(`old tariff protected after welcome offer: ${km} km / ${minutes} min`, () => {
    const raw = Math.max(7.5, 1.5 + km * 0.68 + minutes * 0.14);
    for (const discount of [0, 0.10, 0.15]) {
      const fare = guard(raw - Math.min(raw * discount, 6), 12, km);
      const c = Math.round(fare * 100);
      const fee = Math.round(c * .12);
      assert.ok(c - fee >= Math.max(900, Math.ceil(km * 101)));
      assert.equal(c, (c - fee) + fee);
    }
  });
}

test('same shared guard runs in browser and server', () => {
  const code = readFileSync(new URL('../assets/ride-fare-guard.js', import.meta.url), 'utf8');
  const browser = {};
  runInNewContext(code, browser);
  assert.equal(browser.VasiRideFareGuard(6, 12, 1), guard(6, 12, 1));
  assert.deepEqual(
    JSON.parse(JSON.stringify(browser.VasiFundedRideQuote(7.5, 12, 1, 15, 6))),
    fundedQuote(7.5, 12, 1, 15, 6),
  );
  const ui = readFileSync(new URL('../ride-flow.html', import.meta.url), 'utf8');
  assert.match(ui, /assets\/ride-fare-guard\.js/);
  assert.match(ui, /VasiRideFareGuard\(unprotectedPriceFor/);
});

test('invalid pricing never returns an unprotected fare', () => {
  assert.throws(() => guard(NaN), RangeError);
  assert.throws(() => guard(10, 100), RangeError);
  assert.throws(() => guard(10, 12, -1), RangeError);
});
