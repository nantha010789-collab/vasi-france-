import test from 'node:test';
import assert from 'node:assert/strict';
import routePreview from '../api/route-preview.js';
import createRide from '../api/create-ride.js';
import '../assets/ride-fare-guard.js';

const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
const res=()=>({code:200,setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}});
const points=[{lat:48.698071,lng:2.504543},{lat:48.997347,lng:2.378493}];
const request=()=>({method:'POST',headers:{authorization:'Bearer TEST_ONLY'},body:{
  pickup_address:'Brunoy',pickup_lat:points[0].lat,pickup_lng:points[0].lng,
  destination_address:'Sarcelles',destination_lat:points[1].lat,destination_lng:points[1].lng,
  service:'VASI Go',payment_method:'cash',
}});

test('preview and booking use the same Google route instead of pricing a different OSRM route',async()=>{
  const original=global.fetch,key=process.env.GOOGLE_ROUTES_API_KEY;
  process.env.GOOGLE_ROUTES_API_KEY='TEST_ONLY';let routes=0,created;
  global.fetch=async(url,options={})=>{
    const u=String(url);
    if(u.includes('vasi_pricing_settings'))return response([],503);
    if(u.includes('routes.googleapis.com')){routes++;return response({routes:[{distanceMeters:52300,duration:'5160s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]})}
    if(u.includes('/api/customer-offer'))return response({active:true,discount_percent:5,max_discount_eur:3});
    if(u.includes('/rpc/create_customer_ride')){created=JSON.parse(options.body);return response({id:'TEST_RIDE'})}
    if(u.includes('/rpc/vasi_dispatch_ride'))return response(0);
    throw Error('Unexpected request '+u);
  };
  try{
    const preview=res();await routePreview({method:'POST',headers:{},body:{points}},preview);
    assert.equal(preview.code,200);assert.equal(preview.body.provider,'google-routes');
    const quote=VasiFundedRideQuote(1.5+preview.body.distance_km*.68+preview.body.duration_min*.14,12,preview.body.distance_km,5,3);
    const req=request();req.body.quoted_fare=quote.customer_fare;
    const booking=res();await createRide(req,booking);assert.equal(booking.code,201);
    assert.equal(created.p_estimated_distance_km,52.3);assert.equal(created.p_estimated_duration_minutes,86);
    assert.equal(created.p_estimated_fare,quote.customer_fare);assert.equal(routes,2);
    assert.equal(created.p_driver_amount,52.84);assert.equal(created.p_customer_discount,2.79);
  }finally{global.fetch=original;if(key===undefined)delete process.env.GOOGLE_ROUTES_API_KEY;else process.env.GOOGLE_ROUTES_API_KEY=key}
});

test('a changed quote returns 409 before creating or dispatching any ride',async()=>{
  const original=global.fetch;let creates=0;
  global.fetch=async url=>{
    const u=String(url);
    if(u.includes('vasi_pricing_settings'))return response([],503);
    if(u.includes('router.project-osrm.org'))return response({routes:[{distance:67704,duration:5880}]});
    if(u.includes('/api/customer-offer'))return response({},404);
    creates++;throw Error('Must not create or dispatch');
  };
  try{const req=request();req.body.quoted_fare=59.04;const r=res();await createRide(req,r);
    assert.equal(r.code,409);assert.equal(r.body.price_changed,true);assert.equal(creates,0);
  }finally{global.fetch=original}
});

test('booking keeps the exact selected stop coordinates instead of geocoding another location',async()=>{
  const original=global.fetch;let routeUrl='';
  global.fetch=async(url,options={})=>{
    const u=String(url);
    if(u.includes('vasi_pricing_settings'))return response([],503);
    if(u.includes('router.project-osrm.org')){routeUrl=u;return response({routes:[{distance:52300,duration:5160}]})}
    if(u.includes('/api/customer-offer'))return response({},404);
    if(u.includes('/rpc/create_customer_ride'))return response({id:'TEST_RIDE'});
    if(u.includes('/ride_stops')){assert.equal(JSON.parse(options.body)[0].latitude,48.8);return response(null,204)}
    if(u.includes('/rpc/vasi_dispatch_ride'))return response(0);
    throw Error('Unexpected request '+u);
  };
  try{const req=request();req.body.stops=['Selected public stop'];req.body.stop_points=[{lat:48.8,lng:2.4}];
    const r=res();await createRide(req,r);assert.equal(r.code,201);assert.match(routeUrl,/2\.504543,48\.698071;2\.4,48\.8;2\.378493,48\.997347/);
  }finally{global.fetch=original}
});
