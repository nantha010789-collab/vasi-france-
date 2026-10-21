const specificPlace = /\b(gare|station|a[eé]roport|airport|h[oô]pital|hospital|carrefour|lidl|market|restaurant|hotel|hôtel)\b/i;
export function usableGeocode(result, query) {
  const lat = Number(result?.lat), lon = Number(result?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) return false;
  const a = result.address || {};
  // A city centroid is not a verified station, shop or other named destination.
  if (specificPlace.test(query)) {
    const coarse = ['administrative', 'city', 'town', 'village', 'municipality', 'postcode', 'locality', 'postal_code'];
    if (coarse.includes(result.type) || (!a.road && !a.pedestrian && !a.house_number && !a.amenity && !a.shop && !a.railway && !a.tourism && !a.building && !result.name)) return false;
  }
  return true;
}
