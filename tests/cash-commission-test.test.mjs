import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCashTestHandler} from '../api/cash-commission-test.js';

function fixture(options={}) {
  const email='test-admin@example.com',owner=createHash('sha256').update(email).digest('hex');
  const metadata={service:'vasi_cash_commission_test',owner};
  const owned={livemode:false,metadata};
  const session={...owned,id:'cs_test_fixture',mode:'setup',status:'complete',customer:'cus_fixture',setup_intent:'seti_fixture'};
  const setup={...owned,id:'seti_fixture',status:'succeeded',customer:'cus_fixture',mandate:'mandate_fixture',payment_method:'pm_fixture'};
  const mandate={id:'mandate_fixture',livemode:false,status:'active',payment_method:'pm_fixture'};
  let payment=options.payment ? {...owned,id:'pi_fixture',customer:'cus_fixture',amount:1200,currency:'eur',status:options.payment,amount_received:options.payment==='succeeded'?1200:0,metadata:{...metadata,setup_session:session.id},latest_charge:{disputed:false,amount_refunded:0}} : null;
  const calls=[];
  const handler=createCashTestHandler({key:options.key||'sk_test_FAKE',authorize:async()=>options.forbidden?null:{email},stripe:async(method,path,params,idem)=>{
    calls.push({method,path,params,idem});
    if(method==='POST'&&path==='/v1/customers')return {...owned,id:'cus_fixture'};
    if(method==='POST'&&path==='/v1/checkout/sessions')return {...session,url:'https://checkout.stripe.com/test/session'};
    if(method==='GET'&&path.startsWith('/v1/checkout/sessions/'))return session;
    if(method==='GET'&&path.startsWith('/v1/customers/'))return {...owned,id:'cus_fixture'};
    if(method==='GET'&&path.startsWith('/v1/setup_intents/'))return setup;
    if(method==='GET'&&path.startsWith('/v1/mandates/'))return mandate;
    if(method==='GET'&&path.startsWith('/v1/payment_intents?'))return {data:payment?[payment]:[]};
    if(method==='POST'&&path==='/v1/payment_intents'){
      payment={...owned,id:'pi_fixture',customer:'cus_fixture',amount:1200,currency:'eur',status:'processing',amount_received:0,metadata:{...metadata,setup_session:session.id},latest_charge:null};return payment;
    }
    throw Error('Unexpected Stripe call '+method+' '+path);
  }});
  const request=async(body={action:'collect',session:session.id},extra={})=>{
    const response={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},status(code){this.statusCode=code;return this},json(data){this.body=data;return this}};
    await handler({method:'POST',headers:{authorization:'Bearer TEST'},body,...extra},response);return response;
  };
  return {request,calls,session,setup,mandate,get payment(){return payment}};
}

test('cash test rejects missing auth and non-admin access before Stripe',async()=>{
  for(const options of [{},{forbidden:true}]){
    const f=fixture(options),r=await f.request(undefined,options.forbidden?{}:{headers:{}});
    assert.equal(r.statusCode,options.forbidden?403:401);assert.equal(f.calls.length,0);
  }
});
test('cash test refuses a live Stripe key without making a Stripe call',async()=>{
  const f=fixture({key:'sk_live_FAKE'}),r=await f.request();assert.equal(r.statusCode,503);assert.equal(f.calls.length,0);
});
test('test setup uses hosted SEPA mandate, synthetic customer, fixed return URL and idempotency',async()=>{
  const f=fixture(),r=await f.request({action:'setup',request_id:'12345678-1234-1234-1234-123456789012',amount:99999,return_url:'https://attacker.invalid'});
  assert.equal(r.statusCode,200);assert.equal(r.body.test_mode,true);
  const call=f.calls.find(x=>x.path==='/v1/checkout/sessions');
  assert.equal(call.params.mode,'setup');assert.equal(call.params['payment_method_types[]'],'sepa_debit');assert.equal(call.params.currency,'eur');
  assert.match(call.params.success_url,/^https:\/\/www.vasigo.eu\/admin\/cash-test.html\?/);assert.ok(call.idem);
  assert(!JSON.stringify(f.calls).includes('test-admin@example.com'));assert(!JSON.stringify(f.calls).includes('attacker.invalid'));
});
test('test collection requires a completed setup and active matching mandate',async()=>{
  for(const mutate of [f=>f.session.status='open',f=>f.setup.status='requires_payment_method',f=>f.setup.customer='cus_other',f=>f.mandate.status='inactive',f=>f.mandate.payment_method='pm_other']){
    const f=fixture();mutate(f);const r=await f.request();assert.equal(r.statusCode,409);assert(!f.calls.some(x=>x.method==='POST'));
  }
});
test('live or foreign test sessions cannot be accessed',async()=>{
  for(const mutate of [f=>f.session.livemode=true,f=>f.session.metadata={service:'other',owner:'other'}]){
    const f=fixture();mutate(f);assert.equal((await f.request()).statusCode,403);
  }
  const f=fixture();assert.equal((await f.request({action:'collect',session:'cs_live_123'})).statusCode,400);assert.equal(f.calls.length,0);
});
test('SEPA processing leaves the entire fictional debt outstanding',async()=>{
  const f=fixture(),r=await f.request({action:'collect',session:'cs_test_fixture',amount:99999});
  assert.equal(r.body.status,'processing');assert.equal(r.body.remaining,12);assert.equal(r.body.settled,0);
  const call=f.calls.find(x=>x.method==='POST');assert.equal(call.params.amount,'1200');assert.equal(call.params.off_session,'true');assert.equal(call.params.mandate,'mandate_fixture');assert.ok(call.idem);
});
test('repeated collection reuses the same Stripe payment instead of debiting twice',async()=>{
  const f=fixture();await f.request();await f.request();assert.equal(f.calls.filter(x=>x.method==='POST'&&x.path==='/v1/payment_intents').length,1);
});
test('only confirmed succeeded Stripe test payments reduce the fictional balance',async()=>{
  for(const state of ['processing','requires_payment_method','canceled','succeeded']){
    const f=fixture({payment:state}),r=await f.request({}, {method:'GET',query:{session:'cs_test_fixture'}});
    assert.equal(r.statusCode,200);assert.equal(r.body.remaining,state==='succeeded'?0:12);assert(!f.calls.some(x=>x.method==='POST'));
  }
});
test('refunds and disputes restore the outstanding fictional balance',async()=>{
  const refund=fixture({payment:'succeeded'});refund.payment.latest_charge.amount_refunded=500;
  assert.equal((await refund.request()).body.remaining,5);
  const dispute=fixture({payment:'succeeded'});dispute.payment.latest_charge.disputed=true;
  assert.equal((await dispute.request()).body.remaining,12);
});
test('a mismatched payment is blocked and does not clear the test debt',async()=>{
  const f=fixture({payment:'succeeded'});f.payment.amount=9999;assert.equal((await f.request()).statusCode,409);
});
