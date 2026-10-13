import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('admin/app.js','utf8');
const context={};vm.runInNewContext(source.slice(source.indexOf('  function gpsPoint('),source.indexOf('  async function gps(){')),context);
test('admin GPS rejects missing and impossible coordinates without inventing a zero location',()=>{
 for(const [latitude,longitude] of [[null,null],[null,2],[48,undefined],['',2],[' ',2],[false,2],['invalid',2],[91,2],[48,181],[Infinity,2]])assert.equal(context.gpsPoint({latitude,longitude}),null);
 for(const [latitude,longitude] of [[48.8566,2.3522],['48.8566','2.3522'],[0,0],[-90,180]])assert.deepEqual(Array.from(context.gpsPoint({latitude,longitude})),[Number(latitude),Number(longitude)]);
});
