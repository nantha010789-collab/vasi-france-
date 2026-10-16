import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/ride-map-geometry.js';

test('pickup target stays above a phone confirmation sheet', () => {
  const point = VasiPickupMapCenter({left:0,top:0,width:390,height:844}, {width:374,right:382,top:650});
  assert.equal(point.x, 195);
  assert.ok(point.y > 110 && point.y < 650 - 16);
});

test('pickup target uses map space beside a desktop panel', () => {
  const point = VasiPickupMapCenter({left:0,top:0,width:1363,height:936}, {width:460,right:480,top:700});
  assert.ok(point.x > 500 && point.x < 1347);
  assert.ok(point.y > 110 && point.y < 916);
});

test('keyboard-sized viewport still has a visible pickup target', () => {
  const point = VasiPickupMapCenter({left:0,top:0,width:320,height:360}, {width:304,right:312,top:190});
  assert.equal(point.x, 160);
  assert.ok(point.y >= 90 && point.y < 190);
});
