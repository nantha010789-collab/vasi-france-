import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRibTestHandler} from '../api/rib-onboarding-test.js';
const owner=createHash('sha256').update('admin@example.com').digest('hex');
const fixture=(role='driver',extra={})=>({id:'acct_TEST',metadata:{service:'vasi_rib_onboarding_test',owner,role},details_submitted:false,payouts_enabled:false,external_accounts:{data:[]},...extra});
async function run({method='POST',body={action:'onboard',role:'driver',request_id:'fixture-request-1234'},query={},key='sk_test_fixture',authorization='Bearer fixture',authorize=async()=>({email:'admin@example.com'}),stripe=async()=>{throw Error('Unexpected Stripe call');}}={}){
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(b){this.body=b;return this;}};
  await createRibTestHandler({key,authorize,stripe})({method,headers:{authorization},body,query},res);return res;
}
test('RIB test rejects unauthenticated and non-admin callers before Stripe',async()=>{
  assert.equal((await run({authorization:''})).code,401);
  assert.equal((await run({authorize:async()=>null})).code,403);
});
test('RIB test never invokes Stripe with a live or missing key',async()=>{
  for(const key of ['sk_live_fixture','rk_live_fixture',''])assert.equal((await run({key})).code,503);
});
test('RIB test rejects unknown roles, actions, malformed account IDs and missing request IDs',async()=>{
  for(const body of [{action:'onboard',role:'admin'},{action:'pay',role:'driver'},{action:'status',role:'driver',account:'../../live'},{action:'onboard',role:'driver'}])assert.equal((await run({body})).code,400);
});
for(const role of ['driver','courier','restaurant'])test(`RIB ${role} uses an isolated French Express fixture and fixed return URLs`,async()=>{
  const calls=[];
  const r=await run({body:{action:'onboard',role,request_id:'fixture-request-1234',return_url:'https://evil.invalid'},stripe:async(method,path,params,idem)=>{
    calls.push({method,path,params,idem});
    return path==='/v1/accounts'?fixture(role):{url:'https://connect.stripe.com/setup/fixture'};
  }});
  assert.equal(r.code,200);assert.equal(r.body.test_mode,true);assert.equal(r.body.account,'acct_TEST');
  assert.equal(calls[0].params.country,'FR');assert.equal(calls[0].params['controller[stripe_dashboard][type]'],'express');
  assert.equal(calls[0].params['metadata[role]'],role);assert.equal(calls[0].params['capabilities[transfers][requested]'],'true');
  assert.ok(calls[0].idem.includes(role));assert.equal(calls[1].params.type,'account_onboarding');
  assert.equal(calls[1].params.return_url,`https://www.vasigo.eu/admin/rib-test.html?role=${role}&account=acct_TEST`);
  assert.ok(!JSON.stringify(calls).includes('evil.invalid'));
});
test('RIB test refuses foreign owner, wrong role and untagged production accounts',async()=>{
  for(const a of [fixture('courier'),fixture('driver',{metadata:{service:'vasi_rib_onboarding_test',owner:'foreign',role:'driver'}}),{id:'acct_TEST'}]){
    const r=await run({body:{action:'onboard',role:'driver',account:'acct_TEST'},stripe:async()=>a});assert.equal(r.code,403);
  }
});
test('RIB retry reuses the selected owned account without creating another',async()=>{
  const paths=[];
  const r=await run({body:{action:'onboard',role:'driver',account:'acct_TEST'},stripe:async(method,path)=>{paths.push([method,path]);return method==='GET'?fixture():{url:'https://connect.stripe.com/setup/retry'};}});
  assert.equal(r.code,200);assert.deepEqual(paths,[['GET','/v1/accounts/acct_TEST'],['POST','/v1/account_links']]);
});
test('RIB status reads Stripe readiness and does not disclose bank account details',async()=>{
  const r=await run({method:'GET',query:{role:'driver',account:'acct_TEST'},stripe:async()=>fixture('driver',{details_submitted:true,payouts_enabled:true,external_accounts:{data:[{object:'bank_account',last4:'1234',routing_number:'private-bank-data'}]}})});
  assert.equal(r.body.status,'verified');assert.equal(r.body.bank_added,true);assert.equal(r.body.payouts_enabled,true);
  assert.ok(!JSON.stringify(r.body).includes('1234'));assert.ok(!JSON.stringify(r.body).includes('private-bank-data'));
  assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('return alone never marks an incomplete or pending RIB verified',async()=>{
  for(const [details,status] of [[false,'incomplete'],[true,'pending']]){
    const r=await run({method:'GET',query:{role:'driver',account:'acct_TEST'},stripe:async()=>fixture('driver',{details_submitted:details})});assert.equal(r.body.status,status);assert.equal(r.body.payouts_enabled,false);
  }
});
test('RIB test rejects offsite onboarding URLs',async()=>{
  const r=await run({stripe:async(method,path)=>path==='/v1/accounts'?fixture():{url:'https://evil.invalid'}});assert.equal(r.code,409);
});
test('Connect activation uses only the authenticated sandbox and cannot run with a live key',async()=>{
  const paths=[];
  const body={action:'enable_connect'};
  const r=await run({body,stripe:async(method,path)=>{paths.push([method,path]);return {};}});
  assert.equal(r.body.status,'connect_enabled');assert.equal(r.body.test_mode,true);
  assert.deepEqual(paths,[['POST','/v1/_unstable/connect/enable']]);
  assert.equal((await run({body,key:'sk_live_fixture'})).code,503);
});
