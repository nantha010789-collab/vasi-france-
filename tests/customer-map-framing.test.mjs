import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('ride-flow.html','utf8'),c={};vm.runInNewContext(html.slice(html.indexOf('      function routeMapPadding('),html.indexOf('      async function buildRoute()')),c);
test('customer route framing reserves the desktop booking sidebar',()=>{
 const p=c.routeMapPadding({left:0,width:1363,height:936,bottom:936},{width:460,right:480,top:280});assert.equal(p.paddingTopLeft[0],508);assert.equal(p.paddingBottomRight[1],28);
});
test('customer route framing reserves the expanded phone sheet',()=>{
 for(const [width,height] of [[393,852],[320,568]]){
  const panelTop=height*.32,p=c.routeMapPadding({left:0,width,height,bottom:height},{width:width-16,right:width-8,top:panelTop});assert.equal(p.paddingTopLeft[0],28);assert(p.paddingBottomRight[1]>=height-panelTop);assert(height-p.paddingTopLeft[1]-p.paddingBottomRight[1]>=80);
 }
});
