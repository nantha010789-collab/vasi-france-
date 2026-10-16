import test from 'node:test';
import assert from 'node:assert/strict';
import offer from '../api/customer-offer.js';
import '../assets/ride-fare-guard.js';
const originalFetch = global.fetch;
function res() { return { code: 200, setHeader() {}, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } }; }
for (const [name, history, active] of [['first customer', [], true], ['completed ride', [{id:'completed'}], false], ['active booking', [{id:'requested'}], false]]) {
  test(`welcome offer: ${name}`, async () => {
    global.fetch=async url => {
      if(String(url).includes('/auth/v1/user')) return {ok:true,json:async()=>({id:'customer'})};
      assert.ok(String(url).includes('status=neq.cancelled&limit=1'));
      return {ok:true,json:async()=>history};
    };
    try { const r=res();await offer({method:'GET',headers:{authorization:'Bearer test'}},r);assert.equal(r.code,200);assert.equal(r.body.active,active);assert.equal(r.body.discount_percent,active?5:0);assert.equal(r.body.max_discount_eur,active?3:0); }
    finally {global.fetch=originalFetch;}
  });
}
test('welcome offer fails closed if history cannot be checked',async()=>{
  global.fetch=async url=>String(url).includes('/auth/v1/user')?{ok:true,json:async()=>({id:'customer'})}:{ok:false};
  try{const r=res();await offer({method:'GET',headers:{authorization:'Bearer test'}},r);assert.equal(r.code,500);assert.equal(r.body.active,undefined);}finally{global.fetch=originalFetch;}
});
test('welcome offers never use commission reserved for payments and operations',()=>{
 for(const commission of [0,5,12,25,50])for(const km of [1,5,10,52.3,100])for(const fare of [7.5,20,60.04,150]){
  const normal=VasiFundedRideQuote(fare,commission,km,0);
  const welcome=VasiFundedRideQuote(fare,commission,km,5,3);
  const budget=Math.max(0,Math.round(normal.gross_vasi_commission*100)-VasiRideOfferReserveCents(Math.round(normal.settlement_fare*100)));
  assert.ok(Math.round(welcome.customer_discount*100)<=budget);
  assert.equal(welcome.driver_amount,normal.driver_amount);
 }
 const quote=VasiFundedRideQuote(49.104,12,52.3,5,3);
 assert.equal(quote.customer_fare,57.25);assert.equal(quote.driver_amount,52.84);
 assert.equal(quote.vasi_commission,4.41);assert.equal(quote.customer_discount,2.79);
});
test('five percent capped at three euros preserves driver earnings and cost reserves',()=>{
 for(const [fare,km] of [[11.48,10],[22.96,20],[100,40]]) {
  const normal=VasiFundedRideQuote(fare,12,km,0);
  const welcome=VasiFundedRideQuote(fare,12,km,5,3);
  assert.equal(welcome.driver_amount,normal.driver_amount);
  assert.ok(welcome.customer_discount<=3);
  assert.equal(welcome.customer_discount,Math.max(0,Math.min(Math.round(normal.settlement_fare*5)/100,3,Number((normal.gross_vasi_commission-VasiRideOfferReserveCents(Math.round(normal.settlement_fare*100))/100).toFixed(2)))));
  assert.ok(Math.abs(welcome.customer_fare-welcome.driver_amount-welcome.vasi_commission)<0.001);
 }
});
