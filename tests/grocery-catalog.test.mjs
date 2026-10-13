import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={};vm.runInNewContext(readFileSync('vasi-commerce.js','utf8'),context);const c=context.VasiCommerce;
test('store classification preserves existing restaurants and round-trips grocery specialties',()=>{
 assert.equal(c.type('Pizza'),'restaurant');assert.equal(c.type('Supermarché bio'),'restaurant');
 for(const kind of ['grocery','supermarket']){const stored=c.cuisine(kind,'Produits frais');assert.equal(c.type(stored),kind);assert.equal(c.detail(stored),'Produits frais');assert.equal(c.type(c.cuisine(kind,'')),kind)}
 assert.equal(c.cuisine('unknown','Pizza'),'Pizza');assert.equal(c.detail('Cuisine française'),'Cuisine française');
});
test('pack size and product description survive repeated edits without duplication',()=>{
 for(const unit of ['500 g','1 L','6 pièces']){const value=c.description(unit,'Produit frais'),parts=c.splitDescription(value);assert.equal(parts.unit,unit);assert.equal(parts.description,'Produit frais');assert.equal(c.description(parts.unit,parts.description),value)}
 assert.equal(c.splitDescription('Plat traditionnel').description,'Plat traditionnel');assert.equal(c.description('','Plat traditionnel'),'Plat traditionnel');assert.equal(c.splitDescription(c.description('500 g','')).unit,'500 g');assert(c.description('1 L','x'.repeat(1000)).length<=300);
});
test('partner render updates shared category suggestions when the store type changes',()=>{
 const html=readFileSync('restaurant-dashboard.html','utf8');
 const staticDialog=html.slice(html.indexOf('<dialog'),html.indexOf('</dialog>'));
 assert.doesNotMatch(staticDialog,/\$\{/,'static dialog must not contain unevaluated template expressions');
 const nodes={productCategories:{innerHTML:''}};
 const state={restaurant:{name:'Shop',status:'pending',cuisine:'Pizza'},menu:[],orders:[]};
 const ctx={data:state,VasiCommerce:c,app:{},document:{getElementById:id=>nodes[id]},activeStatuses:new Set(),esc:v=>String(v??'').replace(/"/g,'&quot;'),money:String,renderMenu:()=>'',profileForm:()=>''};
 vm.runInNewContext(html.slice(html.indexOf('function render(){'),html.indexOf('function renderMenu(')),ctx);
 for(const [cuisine,expected] of [['Pizza',['Entrées','Plats','Desserts','Boissons']],['Épicerie · Bio',Array.from(c.categories)],['Supermarché · Frais',Array.from(c.categories)],['Pizza',['Entrées','Plats','Desserts','Boissons']]]){
  state.restaurant.cuisine=cuisine;ctx.render();
  const values=[...nodes.productCategories.innerHTML.matchAll(/value="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(values,expected);
  assert.match(ctx.app.innerHTML,/<input name="category"[^>]*list="productCategories"/);
 }
});
