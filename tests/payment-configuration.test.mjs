import test from 'node:test';
import assert from 'node:assert/strict';
import paymentConfig from '../api/payment-config.js';
const response=(body,ok=true)=>({ok,json:async()=>body});
async function run({backend={enabled:true,mode:'test'},account={id:'acct_fixture'},query={},secret='sk_test_fixture',service=true,fail=false,authorization='Bearer fixture'}={}){
  process.env.STRIPE_PUBLISHABLE_KEY='pk_test_fixture';process.env.STRIPE_SECRET_KEY=secret;
  if(service)process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const calls=[];global.fetch=async url=>{calls.push(String(url));if(fail)throw Error('network');return response(String(url).includes('api.stripe.com')?account:backend);};
  const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
  await paymentConfig({method:'GET',query,headers:{authorization}},res);return {...res,calls};
}
test('payment configuration requires matching frontend, server and webhook-backed Stripe accounts',async()=>{
  const r=await run();assert.equal(r.body.enabled,true);assert.equal(r.body.mode,'test');assert.equal(r.body.publishable_key,'pk_test_fixture');
});
test('missing backend configuration never advertises card payments as ready',async()=>{
  const r=await run({backend:{enabled:false,mode:'missing',account_id:null}});assert.equal(r.body.enabled,false);assert.equal(r.body.publishable_key,null);
});
test('payment configuration rejects mismatched accounts and live/test key mixtures',async()=>{
  assert.equal((await run({backend:{enabled:false,mode:'test'}})).body.enabled,false);
  const r=await run({secret:'sk_live_fixture'});assert.equal(r.body.enabled,false);assert.equal(r.calls.length,0);
});
test('food checkout stays disabled when its order-writing service is unavailable',async()=>{
  const r=await run({query:{service:'food'},service:false});assert.equal(r.body.enabled,false);assert.equal(r.calls.length,0);
});
test('payment readiness fails closed on a network error',async()=>{
  assert.equal((await run({fail:true})).body.enabled,false);
});
test('anonymous payment config never calls Stripe or exposes account metadata',async()=>{
  const r=await run({authorization:''});assert.equal(r.body.enabled,false);assert.equal(r.body.reason,'login_required');assert.equal(r.calls.length,0);assert.equal(r.body.account_id,undefined);
});
