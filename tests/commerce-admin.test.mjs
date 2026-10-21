import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceListOptions,catalogueCounts} from '../supabase/functions/admin-service/commerce-admin.js';
test('commerce page bounds are stable and untrusted filters are constrained',()=>{
 assert.deepEqual(commerceListOptions({page:2,store_type:'supermarket',search:'  Lidl%_  '}),{page:2,pageSize:25,type:'supermarket',search:'Lidl',from:25,to:49});
 const invalid=commerceListOptions({page:-30,store_type:'arbitrary'});assert.equal(invalid.page,1);assert.equal(invalid.type,'all');
 assert.equal(commerceListOptions({page:Infinity}).page,100000);
});
test('catalogue readiness distinguishes all items from available items per shop',()=>{
 const counts=catalogueCounts([{restaurant_id:'a',active:true},{restaurant_id:'a',active:false},{restaurant_id:'b',active:true}]);
 assert.deepEqual(counts.get('a'),{total:2,available:1});assert.deepEqual(counts.get('b'),{total:1,available:1});
});
