import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parisDayBounds, financialSummary, readAllReportRows} from '../supabase/functions/admin-service/reporting.js';
import {usableGeocode} from '../api/_geocode-quality.js';
test('Paris reporting includes previous UTC evening and handles both DST boundaries',()=>{
  for(const [date,start,end,hours] of [
    ['2026-07-02T01:00:00Z','2026-07-01T22:00:00.000Z','2026-07-02T22:00:00.000Z',24],
    ['2026-03-29T12:00:00Z','2026-03-28T23:00:00.000Z','2026-03-29T22:00:00.000Z',23],
    ['2026-10-25T12:00:00Z','2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z',25]]){
    const b=parisDayBounds(new Date(date));assert.equal(b.start,start);assert.equal(b.end,end);assert.equal((Date.parse(b.end)-Date.parse(b.start))/3600000,hours);
  }
});
test('financial totals exclude cancelled rides, failed/refunded payments and other currencies',()=>{
  const r=financialSummary([{status:'completed',currency:'EUR',final_fare:26.43,vasi_commission:2.64,driver_amount:23.79},{status:'cancelled',final_fare:100},{status:'completed',currency:'GBP',final_fare:200}], [{status:'succeeded',amount:26.43},{status:'failed',amount:50},{status:'refunded',amount:20},{status:'paid',currency:'GBP',amount:30}]);
  assert.deepEqual(r,{todayGross:26.43,todayCommission:2.64,todayDriverAmount:23.79,todayPaymentsAmount:26.43});
});
test('daily reporting reads beyond one database page and propagates query errors',async()=>{
  const rows=Array.from({length:1201},(_,id)=>({id}));
  const all=await readAllReportRows(()=>({order(){return this},range:async(a,b)=>({data:rows.slice(a,b+1)})})); assert.equal(all.length,1201);
  await assert.rejects(readAllReportRows(()=>({order(){return this},range:async()=>({error:Error('database unavailable')})})),/database unavailable/);
});
test('station queries reject a city centroid instead of silently confirming it',()=>{
  assert.equal(usableGeocode({lat:'48.6',lon:'2.5',type:'locality',address:{postcode:'77176',city:'Melun'}},'Gare de Savigny-le-Temple'),false);
  assert.equal(usableGeocode({lat:'48.6',lon:'2.5',type:'station',name:'Gare',address:{railway:'Gare'}},'Gare de Savigny-le-Temple'),true);
  assert.equal(usableGeocode({lat:'48.6',lon:'2.5',type:'city',address:{city:'Paris'}},'Paris'),true);
});
test('pickup label retains the full named place address and street number',async()=>{
  const context={}; vm.runInNewContext(await readFile(new URL('../assets/ride-address.js',import.meta.url),'utf8'),context);
  const full='Gare de Savigny-le-Temple – Nandy, Place du 19 Mars 1962, 77176 Savigny-le-Temple, France';
  assert.equal(context.VasiRideAddress.format({display_name:full,address:{county:'Melun',postcode:'77176',country:'France'}}),full);
  assert.equal(context.VasiRideAddress.format({name:'EXO MARKET',address:{house_number:'8',road:'Rue Exemple',postcode:'77176',city:'Savigny-le-Temple',country:'France'}}),'EXO MARKET, 8 Rue Exemple, 77176 Savigny-le-Temple, France');
});
