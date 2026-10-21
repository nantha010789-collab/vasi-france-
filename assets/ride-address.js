// Keep the geocoder's full label, including the named place and street.
globalThis.VasiRideAddress = {
  format(found, fallbackText = "Destination") {
    if (typeof found?.display_name === "string" && found.display_name.trim()) return found.display_name.trim();
    const a = found?.address || {};
    const place = found?.name || a.amenity || a.shop || a.tourism || a.railway || a.building || a.name || "";
    const street = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.municipality || a.locality || a.county || "";
    const parts = [place, street, [a.postcode, city].filter(Boolean).join(" "), a.country].filter(Boolean);
    return [...new Set(parts)].join(", ") || fallbackText;
  }
};
