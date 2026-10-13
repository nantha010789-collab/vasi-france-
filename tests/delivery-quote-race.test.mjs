import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(){
 const elements=new Map(),requests=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,disabled:false,textContent:'',classList:{toggle(){}},addEventListener(type,fn){this[type]=fn}});return elements.get(id)};
 const context={document:{getElementById:element},supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'TEST_ONLY'}}})}})},window:{},VasiRegion:{getRegion:()=>({code:'FR'})},VasiLanguage:{getLanguage:()=> 'fr'},VasiNotifications:{start(){}},Intl,localStorage:{setItem(){}},fetch:()=>new Promise(resolve=>requests.push(resolve))};
 const source=[...readFileSync('delivery.html','utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const client='));
 vm.runInNewContext(source,context);return {context,element,requests};
}
const result={pickup:{address:'Resolved pickup'},dropoff:{address:'Resolved destination'},currency:'EUR',quote:10,distance_km:5,duration_min:10};
test('late delivery quote cannot overwrite addresses edited while it loads',async()=>{
 const h=harness();h.element('pickup').value='Old pickup';h.element('dropoff').value='Destination';
 const loading=h.context.getQuote();h.element('pickup').value='New pickup';h.element('pickup').input();
 h.requests[0]({ok:true,json:async()=>result});await loading;
 assert.equal(h.element('pickup').value,'New pickup');assert.equal(h.element('bookBtn').hidden,true);
 await h.context.bookDelivery();assert.equal(h.requests.length,1,'booking without a current quote must not send a request');
});
test('successful delivery quote is invalidated when package type or address changes',async()=>{
 const h=harness();h.element('pickup').value='Pickup';h.element('dropoff').value='Destination';
 const loading=h.context.getQuote();h.requests[0]({ok:true,json:async()=>result});await loading;
 assert.equal(h.element('bookBtn').hidden,false);assert.equal(h.element('pickup').value,'Resolved pickup');
 h.context.selectType('document');assert.equal(h.element('bookBtn').hidden,true);
 await h.context.bookDelivery();assert.equal(h.requests.length,1);
});
