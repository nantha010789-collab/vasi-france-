import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('supabase/functions/admin-service/index.ts','utf8');
const start=source.indexOf("    if (action === 'pay_driver_activity_guarantee') {");
const end=source.indexOf('\n    if (action ===',start+10);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('action','body','db','text','json','Deno','fetch','audit',source.slice(start,end));

async function payment({status='pending',claimedAmount=9,claim=true}={}) {
  let fetches=0,transferred=null;
  const initial={id:'g',driver_id:'d',status,top_up_amount:5,currency:'EUR',period_start:'2024-09-01',period_end:'2024-10-01'};
  let reads=0,writing=false;
  const db={from(table){
    const q={select(){return q},eq(){return q},in(){return q},update(){writing=true;return q},
      async maybeSingle(){
        if(table==='drivers')return {data:{stripe_account_id:'acct_TEST',stripe_details_submitted:true,stripe_payouts_enabled:true}};
        reads++;return {data:writing?(claim?{...initial,status:'processing',top_up_amount:claimedAmount}:null):initial};
      },async single(){return {data:{...initial,status:'paid'}}}};
    return q;
  }};
  const result=await run('pay_driver_activity_guarantee',{guarantee_id:'g'},db,
    v=>String(v||''),(body,status=200)=>({body,status}),{env:{get:()=> 'TEST_ONLY'}},
    async(_url,request)=>{fetches++;transferred=request.body.get('amount');return {ok:true,json:async()=>({id:'tr_TEST'})}},async()=>{});
  return {result,fetches,transferred,reads};
}
test('guarantee payment uses the amount from the atomic claim after concurrent reconciliation',async()=>{
  const p=await payment();assert.equal(p.result.status,200);assert.equal(p.transferred,'900');assert.equal(p.fetches,1);
});
test('a competing payout claim never sends a second transfer',async()=>{
  const p=await payment({claim:false});assert.equal(p.result.status,409);assert.equal(p.fetches,0);
});
test('review and already-paid guarantees cannot trigger a transfer',async()=>{
  const review=await payment({status:'needs_review'});assert.equal(review.result.status,409);assert.equal(review.fetches,0);
  const paid=await payment({status:'paid'});assert.equal(paid.result.status,200);assert.equal(paid.fetches,0);
});
