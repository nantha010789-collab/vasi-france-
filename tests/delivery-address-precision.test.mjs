import test from 'node:test';
import assert from 'node:assert/strict';
import deliveryOrder,{resolveDeliveryAddress} from '../api/delivery-order.js';
const match=(house,extra={})=>({lat:'48.8',lon:'2.4',display_name:`${house||''} Rue de Dijon, 94140 Alfortville, France`,address:{country_code:'fr',road:'Rue de Dijon',house_number:house},...extra});
test('parcel address resolution rejects a street centroid when a house number was entered',async()=>{
  await assert.rejects(resolveDeliveryAddress('36 Rue de Dijon, Alfortville',async()=>[match(null)]),/numéro de rue/);
});
test('parcel address resolution selects the matching house and preserves its full address',async()=>{
  const r=await resolveDeliveryAddress('36 Rue de Dijon, Alfortville',async()=>[match('34'),match('36')]);assert.equal(r.address,'36 Rue de Dijon, 94140 Alfortville, France');assert.equal(r.lat,48.8);
});
test('parcel address resolution matches bis suffix and rejects another house number',async()=>{
  assert.ok((await resolveDeliveryAddress('36 bis Rue de Dijon, Alfortville',async()=>[match('36bis')])).address);
  await assert.rejects(resolveDeliveryAddress('36 Rue de Dijon, Alfortville',async()=>[match('38')]),/numéro de rue/);
});
test('parcel address resolution rejects foreign results, city-only results and invalid coordinates',async()=>{
  for(const result of [match('36',{address:{country_code:'gb',road:'Road',house_number:'36'}}),match(null,{address:{country_code:'fr',city:'Paris'}}),match('36',{lat:'NaN'})])await assert.rejects(resolveDeliveryAddress('36 Rue de Dijon',async()=>[result]));
});
test('parcel booking cannot create an unpaid courier job while checkout is unavailable',async()=>{
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  global.fetch=async()=>{throw Error('Booking must not call external services');};
  await deliveryOrder({method:'POST',headers:{},body:{action:'book',pickup_address:'36 Rue de Dijon',dropoff_address:'6 Rue Pierre Leroux'}},res);
  assert.equal(res.code,503);assert.match(res.body.error,/Aucun paiement ni commande/);
});
