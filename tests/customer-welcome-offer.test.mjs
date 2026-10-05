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
    try { const r=res();await offer({method:'GET',headers:{authorization:'Bearer test'}},r);assert.equal(r.code,200);assert.equal(r.body.active,active);assert.equal(r.body.discount_percent,active?5:0);assert.equal(r.body.max_discount_eur,active?1:0); }
    finally {global.fetch=originalFetch;}
  });
}
test('welcome offer fails closed if history cannot be checked',async()=>{
  global.fetch=async url=>String(url).includes('/auth/v1/user')?{ok:true,json:async()=>({id:'customer'})}:{ok:false};
  try{const r=res();await offer({method:'GET',headers:{authorization:'Bearer test'}},r);assert.equal(r.code,500);assert.equal(r.body.active,undefined);}finally{global.fetch=originalFetch;}
});
test('five percent capped at one euro preserves driver earnings',()=>{
 for(const [fare,km] of [[11.48,10],[22.96,20],[100,40]]) {
  const normal=VasiFundedRideQuote(fare,12,km,0);
  const welcome=VasiFundedRideQuote(fare,12,km,5,1);
  assert.equal(welcome.driver_amount,normal.driver_amount);
  assert.ok(welcome.customer_discount<=1);
  assert.equal(welcome.customer_discount,Math.min(Math.round(normal.settlement_fare*5)/100,1));
  assert.ok(Math.abs(welcome.customer_fare-welcome.driver_amount-welcome.vasi_commission)<0.001);
 }
});
