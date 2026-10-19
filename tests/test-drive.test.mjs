import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,advance,canAct,parseState,STORAGE_KEY} from '../test-drive-model.js';

test('ride test drive enforces roles, ordered transitions and idempotency',()=>{
 let s=freshState();assert.throws(()=>advance(s,'driver','finishRide'));
 for(const [role,action] of [['customer','requestRide'],['driver','acceptRide'],['driver','arriveRide'],['driver','startRide'],['driver','finishRide']]){const old=s;s=advance(s,role,action);assert.notEqual(s,old);assert.throws(()=>advance(s,role,action));}
 assert.equal(s.ride,'completed');assert.equal(s.food,'idle');assert.equal(s.events.length,5);
});
test('Food demo requires admin approval and restaurant opening before a customer order',()=>{
 let s=freshState();assert.equal(canAct(s,'customer','orderFood'),false);assert.throws(()=>advance(s,'customer','approveRestaurant'));
 for(const [role,action] of [['admin','approveRestaurant'],['restaurant','openRestaurant'],['customer','orderFood'],['restaurant','acceptFood'],['restaurant','prepareFood'],['courier','pickupFood'],['courier','deliverFood']])s=advance(s,role,action);
 assert.equal(s.food,'delivered');assert.equal(s.ride,'idle');assert.equal(s.events.length,7);
});
test('local test data has an isolated key and corrupt saved data resets safely',()=>{
 assert.equal(STORAGE_KEY,'vasi_test_drive_v1');assert.deepEqual(parseState('not json'),freshState());assert.deepEqual(parseState('{"version":1,"ride":"completed"}'),freshState());
 const s=advance(freshState(),'customer','requestRide');assert.deepEqual(parseState(JSON.stringify(s)),s);assert.deepEqual(freshState().events,[]);
});
