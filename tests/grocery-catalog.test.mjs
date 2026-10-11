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
