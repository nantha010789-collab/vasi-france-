import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const id='00000000-0000-4000-8000-000000000001';
async function harness({search='?order_id='+id,session=true,paid=true,status=200}={}){
 const nodes=new Map(),calls=[],removed=[],urls=[];
 const element=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',classList:{remove(){},add(){}}});return nodes.get(id)};
 const ctx={document:{getElementById:element},URLSearchParams,location:{search,pathname:'/food-checkout',origin:'https://example.test'},history:{replaceState:(_,__,url)=>urls.push(url)},localStorage:{getItem:()=>null,setItem(){},removeItem:key=>removed.push(key)},supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:session?{access_token:'TEST_ONLY'}:null}})}})},VasiCommerce:{readBasket:()=>({restaurant_id:null,items:{}})},VasiRegion:{getRegion:()=>({code:'FR'}),money:String},VasiNotifications:{start(){}},Date,Intl,fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return {ok:status===200,json:async()=>({paid,delivery_pin:'1234',error:status===200?undefined:'Payment is pending'})}}};
 const source=[...readFileSync('food-checkout.html','utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const client =')).replace('      initializeCheckout();','      globalThis.ready=initializeCheckout();');
 vm.runInNewContext(source,ctx);await ctx.ready;return {ctx,nodes,calls,removed,urls};
}
test('bank redirect confirms the original order without creating another order',async()=>{
 const h=await harness({search:'?order_id='+id+'&payment_intent_client_secret=TEST_ONLY'});
 assert.deepEqual(h.calls,[{action:'confirm',order_id:id}]);assert.match(h.nodes.get('status').innerHTML,/Payment successful/);assert.equal(h.nodes.get('orderBtn').hidden,true);assert.deepEqual(h.urls,['/food-checkout?order_id='+id]);assert.deepEqual(h.removed,['vasi_food_basket']);
});
test('unconfirmed bank return keeps the basket and offers a safe status retry',async()=>{
 const h=await harness({status:409,paid:false});assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'confirm');assert.deepEqual(h.removed,[]);assert.match(h.nodes.get('status').innerHTML,/Check payment status again/);assert.doesNotMatch(h.nodes.get('status').innerHTML,/Payment successful/);
});
test('returned order requires sign-in and preserves its return destination',async()=>{
 const h=await harness({session:false});assert.deepEqual(h.calls,[]);assert.match(h.nodes.get('status').innerHTML,/Sign in/);assert.match(h.nodes.get('status').innerHTML,/next=food-checkout/);
});
test('invalid return reference cannot fall through to a new checkout',async()=>{
 const h=await harness({search:'?order_id=invalid'});assert.deepEqual(h.calls,[]);assert.match(h.nodes.get('status').textContent,/Invalid order reference/);assert.equal(h.nodes.get('orderBtn').hidden,true);
});
