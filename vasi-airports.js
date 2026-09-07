(function (global) {
  "use strict";

  const AIRPORTS = {
    CDG: {
      name: "Paris–Charles de Gaulle",
      aliases: ["cdg", "charles de gaulle", "roissy", "roissy-en-france"],
      centre: [49.0097, 2.5479],
      radiusKm: 11,
      terminals: ["1", "2A", "2B", "2C", "2D", "2E", "2F", "2G", "3"],
      mapUrl: "https://www.parisaeroport.fr/fr/passagers/a-l-aeroport/plans-terminaux/cdg",
      sourceUrl: "https://www.uber.com/global/en/r/airports/cdg/pickup/",
      routes: {
        "3": {
          zone: { fr: "Zone de prise en charge près du parking P3", en: "Pickup area by car park P3" },
          steps: {
            fr: [
              "Après la livraison des bagages, suivez la sortie « Transports terrestres ».",
              "À la sortie du Terminal 3, tournez à droite et suivez le chemin jusqu’au panneau bleu P3.",
              "Traversez au premier passage piéton vers P3. La zone se trouve derrière la première rangée de haies.",
            ],
            en: [
              "After baggage claim, follow the Ground Transport exit.",
              "Outside Terminal 3, turn right and follow the walkway to the blue P3 sign.",
              "Cross at the first pedestrian crossing toward P3. The pickup area is behind the first row of hedges.",
            ],
          },
        },
      },
    },
    ORY: {
      name: "Paris–Orly",
      aliases: ["ory", "paris orly", "paris-orly", "aéroport d'orly", "aeroport d'orly"],
      centre: [48.7262, 2.3652],
      radiusKm: 8,
      terminals: ["1", "2", "3", "4"],
      mapUrl: "https://www.parisaeroport.fr/fr/passagers/a-l-aeroport/plans-terminaux/ory",
      sourceUrl: "https://www.uber.com/global/en/r/airports/ory/pickup/",
      routes: {
        "1": {
          zone: { fr: "Zone applications de transport · sortie 10a", en: "Ride-app pickup zone · exit 10a" },
          steps: {
            fr: [
              "Après la livraison des bagages, suivez les panneaux « Ride App Pick-up » vers la sortie 10a.",
              "Sortez par la porte 10a, puis continuez tout droit en suivant les panneaux de prise en charge.",
              "Attendez dans la zone indiquée et vérifiez la plaque du véhicule VASI.",
            ],
            en: [
              "After baggage claim, follow the Ride App Pick-up signs toward exit 10a.",
              "Leave through door 10a, then continue straight following the pickup signs.",
              "Wait in the marked area and verify the VASI vehicle plate.",
            ],
          },
        },
        "2": { sameAs: "1" },
        "4": {
          zone: { fr: "Zone applications de transport · sortie 48A", en: "Ride-app pickup zone · exit 48A" },
          steps: {
            fr: [
              "Après la livraison des bagages, suivez le panneau « Ride App Pick-up » et sortez par la porte 48A.",
              "Suivez le chemin à gauche sous les panneaux de prise en charge, puis tournez à gauche au bout.",
              "Attendez dans la zone indiquée et vérifiez la plaque du véhicule VASI.",
            ],
            en: [
              "After baggage claim, follow the Ride App Pick-up sign and leave through door 48A.",
              "Follow the left-hand walkway under the pickup signs, then turn left at the end.",
              "Wait in the marked area and verify the VASI vehicle plate.",
            ],
          },
        },
      },
    },
    BVA: {
      name: "Paris Beauvais–Tillé",
      aliases: ["bva", "beauvais", "beauvais-tillé", "beauvais tille", "tillé airport", "tille airport"],
      centre: [49.4544, 2.1128],
      radiusKm: 6,
      terminals: ["1", "2"],
      mapUrl: "https://www.aeroportparisbeauvais.com/",
      sourceUrl: "https://www.uber.com/global/en/r/airports/bva/pickup/",
      routes: {},
    },
  };

  const clean = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terminalKey = (value) => String(value || "").trim().toUpperCase().replace(/^TERMINAL\s*/i, "").replace(/\s+/g, "");

  function distanceKm(a, b) {
    const rad = (n) => (n * Math.PI) / 180;
    const dLat = rad(b[0] - a[0]);
    const dLng = rad(b[1] - a[1]);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function detect(input = {}) {
    const explicit = terminalKey(input.code);
    if (AIRPORTS[explicit]) return explicit;
    const address = clean(input.address);
    if (address) {
      const found = Object.entries(AIRPORTS).find(([code, airport]) =>
        airport.aliases.some((alias) => address.includes(clean(alias))) || address.includes(clean(code)),
      );
      if (found) return found[0];
    }
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const nearest = Object.entries(AIRPORTS)
      .map(([code, airport]) => ({ code, distance: distanceKm([lat, lng], airport.centre), radius: airport.radiusKm }))
      .sort((a, b) => a.distance - b.distance)[0];
    return nearest && nearest.distance <= nearest.radius ? nearest.code : null;
  }

  function routeFor(airport, terminal) {
    let route = airport.routes[terminalKey(terminal)];
    if (route?.sameAs) route = airport.routes[route.sameAs];
    return route || null;
  }

  function guidance(code, terminal, language = "fr") {
    const airportCode = detect({ code });
    const airport = AIRPORTS[airportCode];
    if (!airport) return null;
    const lang = language === "fr" ? "fr" : "en";
    const selectedTerminal = terminalKey(terminal);
    const route = routeFor(airport, selectedTerminal);
    const generic = lang === "fr"
      ? [
          "Après la livraison des bagages, suivez les panneaux « VTC », « Ride App Pick-up » ou « Transports terrestres ».",
          "Consultez à nouveau cette page après l’attribution du chauffeur : le point exact dépend du terminal, de l’heure et des règles de l’aéroport.",
          "Contactez le chauffeur dans VASI si le point de rencontre a changé.",
        ]
      : [
          "After baggage claim, follow the VTC, Ride App Pick-up or Ground Transport signs.",
          "Check this page again after driver matching: the exact point depends on your terminal, time and airport rules.",
          "Contact the driver in VASI if the meeting point has changed.",
        ];
    return {
      code: airportCode,
      name: airport.name,
      terminal: selectedTerminal,
      terminals: [...airport.terminals],
      zone: route?.zone?.[lang] || (lang === "fr" ? "Zone VTC confirmée avec votre chauffeur" : "VTC zone confirmed with your driver"),
      specific: Boolean(route),
      steps: route?.steps?.[lang] || generic,
      notice: lang === "fr"
        ? "Les zones peuvent changer. Vérifiez le point exact dans VASI après l’attribution du chauffeur."
        : "Pickup zones can change. Confirm the exact point in VASI after driver matching.",
      mapUrl: airport.mapUrl,
      sourceUrl: airport.sourceUrl,
    };
  }

  global.VasiAirports = Object.freeze({ AIRPORTS, detect, guidance, terminalKey });
})(typeof window !== "undefined" ? window : globalThis);
