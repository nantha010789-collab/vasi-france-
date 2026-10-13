import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('food-checkout.html','utf8');
test('payment configuration failure stops checkout before creating an order',async()=>{
 const nodes={address:{value:'Paris'},orderBtn:{},status:{}},calls=[];
 const ctx={el:id=>nodes[id],client:{auth:{getSession:async()=>({data:{session:{access_token:'TEST_ONLY'}}})}},fetch:async path=>{calls.push(path);return {ok:true,json:async()=>({enabled:false})}},localStorage:{setItem(){}}};
 vm.runInNewContext(source.slice(source.indexOf('      async function preparePayment()'),source.indexOf('      async function payNow()')),ctx);await ctx.preparePayment();
 assert.deepEqual(calls,['/api/payment-config']);assert.match(nodes.status.textContent,/not configured/);assert.equal(nodes.orderBtn.disabled,false);
});
test('scheduled checkout derives calendar dates in the phone timezone',()=>{
 const ctx={};vm.runInNewContext(source.slice(source.indexOf('      function localDate('),source.indexOf('      function scheduledFor()')),ctx);
 // A clock whose local date is already tomorrow while UTC is still yesterday.
 class Clock extends Date{constructor(value){super(value??'2026-10-13T21:30:00Z')}static now(){return new Clock().getTime()}getFullYear(){return 2026}getMonth(){return 9}getDate(){return this.getTime()>=Date.parse('2026-10-13T22:00:00Z')?14:13}getHours(){return this.getTime()>=Date.parse('2026-10-13T22:00:00Z')?0:23}getMinutes(){return 30}}
 const nodes={deliveryTiming:{value:'scheduled'},scheduleFields:{},scheduleDate:{value:''},scheduleTime:{}};ctx.Date=Clock;ctx.el=id=>nodes[id];ctx.toggleSchedule();assert.equal(nodes.scheduleDate.value,'2026-10-14');assert.equal(nodes.scheduleTime.value,'00:30');assert.equal(nodes.scheduleDate.min,'2026-10-13');
});
