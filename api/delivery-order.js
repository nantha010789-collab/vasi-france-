import routePreview, { getDrivingRoute } from './route-preview.js';
const PRICING = {
  document: { base: 4, km: 0.65, min: 0.10, minimum: 6 },
  parcel: { base: 5, km: 0.80, min: 0.12, minimum: 7.5 },
};
function cleanAddress(value) {
  const address = String(value || "").trim();
  if (address.length < 4 || address.length > 200) throw new Error("Enter a valid full address");
  return address;
}

async function lookupAddress(address) {
  const response={code:200,setHeader(){},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
  await routePreview({method:'GET',headers:{},query:{q:address,country:'FR'}},response);
  if(response.code!==200) throw new Error('Address search is temporarily unavailable');
  return response.data?.results || [];
}

export async function resolveDeliveryAddress(address,lookup=lookupAddress) {
  const number=address.match(/^(\d+(?:\s*(?:bis|ter|quater|[a-z]))?)\b/i)?.[1];
  const normalized=value=>String(value||'').replace(/\s+/g,'').toLowerCase();
  const results=await lookup(address);
  const result=results.find(candidate=>{
    const lat=Number(candidate.lat),lng=Number(candidate.lon);
    return Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180
      &&candidate.address?.country_code==='fr'
      &&(candidate.address?.road||candidate.address?.house_number)
      &&(!number||normalized(candidate.address?.house_number)===normalized(number));
  });
  if(!result) throw new Error(number?'Adresse exacte introuvable : le numéro de rue doit être confirmé. Précisez le code postal et la ville.':'Adresse de livraison imprécise. Indiquez une rue et une ville en France.');
  return {lat:Number(result.lat),lng:Number(result.lon),address:result.display_name||address};
}

async function route(pickup, dropoff) {
  const best=await getDrivingRoute([pickup,dropoff],{metricsOnly:true});
  if (!best || !Number.isFinite(best.distance_km) || !Number.isFinite(best.duration_min)) throw new Error("No driving route was found between these addresses");
  const distanceKm = best.distance_km;
  if (distanceKm > 150) throw new Error("VASI local delivery currently supports routes up to 150 km");
  return { distanceKm, durationMin: Math.max(1, Math.ceil(best.duration_min)) };
}

function calculatePrice(type, metrics, pricing = PRICING) {
  const p = pricing[type];
  return Number(Math.max(p.minimum, p.base + metrics.distanceKm * p.km + metrics.durationMin * p.min).toFixed(2));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const body = req.body || {};
    // Quotes remain available; never dispatch an unpaid parcel as a paid booking.
    if(body.action==='book')return res.status(503).json({error:'La réservation de colis n’est pas encore disponible. Aucun paiement ni commande n’a été créé.'});
    const country = "FR";
    const currency = "EUR";
    const pricing = PRICING;
    const type = String(body.item_type || "parcel").toLowerCase();
    if (!pricing[type]) return res.status(400).json({ error: "Choose parcel or document" });
    const [pickup, dropoff] = await Promise.all([resolveDeliveryAddress(cleanAddress(body.pickup_address)), resolveDeliveryAddress(cleanAddress(body.dropoff_address))]);
    const metrics = await route(pickup, dropoff);
    const quote = calculatePrice(type, metrics, pricing);
    const result = { pickup, dropoff, item_type: type, distance_km: Number(metrics.distanceKm.toFixed(2)), duration_min: metrics.durationMin, quote, currency, country, booking_available:false };
    return res.status(200).json(result);
  } catch (error) {
    const message = error?.message || "Delivery service error";
    return res.status(/address|adresse|route|150 km/i.test(message) ? 400 : 502).json({ error: message });
  }
}
