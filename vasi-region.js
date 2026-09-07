(() => {
  "use strict";

  const STORAGE_KEY = "vasi_country_v1";
  const REGIONS = Object.freeze({
    FR: Object.freeze({
      code: "FR",
      countryCode: "fr",
      name: "France",
      shortName: "France",
      flag: "🇫🇷",
      currency: "EUR",
      currencySymbol: "€",
      locale: "fr-FR",
      phonePrefix: "+33",
      phonePlaceholder: "06 12 34 56 78",
      emergencyNumber: "112",
      addressSuffix: "France",
      googleRegion: "fr",
      defaultMap: [48.8566, 2.3522],
    }),
    GB: Object.freeze({
      code: "GB",
      countryCode: "gb",
      name: "United Kingdom",
      shortName: "UK",
      flag: "🇬🇧",
      currency: "GBP",
      currencySymbol: "£",
      locale: "en-GB",
      phonePrefix: "+44",
      phonePlaceholder: "07123 456789",
      emergencyNumber: "999 / 112",
      addressSuffix: "United Kingdom",
      googleRegion: "uk",
      defaultMap: [51.5074, -0.1278],
    }),
  });

  function normalizeCountry(value) {
    const code = String(value || "").trim().toUpperCase();
    return code === "UK" ? "GB" : REGIONS[code] ? code : "FR";
  }

  function getCountry() {
    try {
      return normalizeCountry(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return "FR";
    }
  }

  function getRegion(country = getCountry()) {
    return REGIONS[normalizeCountry(country)];
  }

  function setCountry(country) {
    const next = normalizeCountry(country);
    const previous = getCountry();
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    if (previous !== next) {
      window.dispatchEvent(
        new CustomEvent("vasi:countrychange", { detail: getRegion(next) }),
      );
    }
    return getRegion(next);
  }

  function money(value, country = getCountry()) {
    const region = getRegion(country);
    return new Intl.NumberFormat(region.locale, {
      style: "currency",
      currency: region.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function normalizePhone(value, country = getCountry()) {
    const compact = String(value || "").replace(/[\s().-]/g, "");
    if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
    const region = getRegion(country);
    if (region.code === "FR") {
      if (/^0[1-9]\d{8}$/.test(compact)) return "+33" + compact.slice(1);
      if (/^33[1-9]\d{8}$/.test(compact)) return "+" + compact;
    }
    if (region.code === "GB") {
      if (/^0\d{10}$/.test(compact)) return "+44" + compact.slice(1);
      if (/^44\d{10}$/.test(compact)) return "+" + compact;
    }
    return "";
  }

  window.VasiRegion = Object.freeze({
    countries: REGIONS,
    getCountry,
    getRegion,
    setCountry,
    money,
    normalizePhone,
  });
})();
