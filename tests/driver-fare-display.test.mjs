import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('driver.html','utf8'),c={money:n=>'€'+Number(n).toFixed(2),esc:v=>String(v).replace(/[<>]/g,'')};vm.runInNewContext(html.slice(html.indexOf('      function driverFareBreakdown('),html.indexOf('      function showOffer(')),c);
test('driver sees stored customer fare, platform share, driver gain and trip metrics',()=>{
 const out=c.driverFareBreakdown({estimated_fare:20,driver_amount:17.6,vasi_commission:2.4,commission_percent:12,estimated_distance_km:10,estimated_duration_minutes:20});
 for(const text of ['€20.00','€17.60','€2.40','10.0 km','20 min','€1.76/km','12 %','avant carburant'])assert(out.includes(text),text);
});
test('VASI-funded discount is shown without taking the discount from driver gain',()=>{
 const out=c.driverFareBreakdown({estimated_fare:19,driver_amount:17.6,vasi_commission:1.4,customer_discount:1});
 for(const text of ['€19.00','€17.60','€1.40','après remise','€1.00','sans réduction'])assert(out.includes(text),text);
});
test('legacy or missing amounts never present the full customer fare as driver earning',()=>{
 const out=c.driverFareBreakdown({estimated_fare:20,estimated_distance_km:0});assert.match(out,/Votre gain après commission<\/span><b>À confirmer/);assert.doesNotMatch(out,/Infinity|NaN|\/km/);
 const fallback=c.driverFareBreakdown({estimated_fare:20,driver_amount:17.6});assert(fallback.includes('€2.40'));
});
test('offer pricing metadata stays behind the existing verified own-offer gate',()=>{
 const sql=readFileSync('supabase/migrations/20261016002047_driver_offer_fare_breakdown.sql','utf8');assert.match(sql,/auth\.uid\(\) is null/);assert.match(sql,/from public\.vasi_driver_offer_details\(\) as offer/);assert.match(sql,/ride\.id = offer\.ride_id/);assert.match(sql,/revoke all .* from public, anon/);assert.match(sql,/set search_path = ''/);assert.doesNotMatch(sql,/\b(insert|update|delete)\b/i);
});
