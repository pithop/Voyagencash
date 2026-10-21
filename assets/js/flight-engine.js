/* Local demonstration inventory. No live airline availability or issued fares. */
(() => {
  "use strict";
  const rows = [
    [
      "CDG",
      "Paris",
      "Charles-de-Gaulle",
      "France",
      49.01,
      2.55,
      "Europe/Paris",
    ],
    ["ORY", "Paris", "Orly", "France", 48.73, 2.37, "Europe/Paris"],
    [
      "MRS",
      "Marseille",
      "Marseille Provence",
      "France",
      43.44,
      5.22,
      "Europe/Paris",
    ],
    ["LYS", "Lyon", "Saint-Exupéry", "France", 45.73, 5.09, "Europe/Paris"],
    ["NCE", "Nice", "Côte d’Azur", "France", 43.66, 7.22, "Europe/Paris"],
    ["TLS", "Toulouse", "Blagnac", "France", 43.63, 1.36, "Europe/Paris"],
    [
      "NTE",
      "Nantes",
      "Nantes Atlantique",
      "France",
      47.15,
      -1.61,
      "Europe/Paris",
    ],
    ["BOD", "Bordeaux", "Mérignac", "France", 44.83, -0.72, "Europe/Paris"],
    ["LIL", "Lille", "Lesquin", "France", 50.56, 3.09, "Europe/Paris"],
    ["SXB", "Strasbourg", "Entzheim", "France", 48.54, 7.63, "Europe/Paris"],
    [
      "MPL",
      "Montpellier",
      "Méditerranée",
      "France",
      43.58,
      3.96,
      "Europe/Paris",
    ],
    ["BIA", "Bastia", "Poretta", "France", 42.55, 9.48, "Europe/Paris"],
    [
      "AJA",
      "Ajaccio",
      "Napoléon Bonaparte",
      "France",
      41.92,
      8.8,
      "Europe/Paris",
    ],
    [
      "ALG",
      "Alger",
      "Houari Boumédiène",
      "Algérie",
      36.69,
      3.22,
      "Africa/Algiers",
    ],
    [
      "ORN",
      "Oran",
      "Ahmed Ben Bella",
      "Algérie",
      35.62,
      -0.62,
      "Africa/Algiers",
    ],
    [
      "CZL",
      "Constantine",
      "Mohamed Boudiaf",
      "Algérie",
      36.28,
      6.62,
      "Africa/Algiers",
    ],
    [
      "CMN",
      "Casablanca",
      "Mohammed V",
      "Maroc",
      33.37,
      -7.59,
      "Africa/Casablanca",
    ],
    ["RAK", "Marrakech", "Ménara", "Maroc", 31.61, -8.04, "Africa/Casablanca"],
    ["FEZ", "Fès", "Saïss", "Maroc", 33.93, -4.98, "Africa/Casablanca"],
    ["AGA", "Agadir", "Al Massira", "Maroc", 30.33, -9.41, "Africa/Casablanca"],
    [
      "TNG",
      "Tanger",
      "Ibn Battouta",
      "Maroc",
      35.73,
      -5.92,
      "Africa/Casablanca",
    ],
    ["TUN", "Tunis", "Tunis-Carthage", "Tunisie", 36.85, 10.23, "Africa/Tunis"],
    ["DJE", "Djerba", "Zarzis", "Tunisie", 33.88, 10.78, "Africa/Tunis"],
    ["MAD", "Madrid", "Barajas", "Espagne", 40.47, -3.56, "Europe/Madrid"],
    ["BCN", "Barcelone", "El Prat", "Espagne", 41.3, 2.08, "Europe/Madrid"],
    ["FCO", "Rome", "Fiumicino", "Italie", 41.8, 12.25, "Europe/Rome"],
    ["MXP", "Milan", "Malpensa", "Italie", 45.63, 8.72, "Europe/Rome"],
    [
      "LIS",
      "Lisbonne",
      "Humberto Delgado",
      "Portugal",
      38.77,
      -9.13,
      "Europe/Lisbon",
    ],
    [
      "OPO",
      "Porto",
      "Francisco Sá Carneiro",
      "Portugal",
      41.24,
      -8.68,
      "Europe/Lisbon",
    ],
    [
      "LHR",
      "Londres",
      "Heathrow",
      "Royaume-Uni",
      51.47,
      -0.45,
      "Europe/London",
    ],
    ["LGW", "Londres", "Gatwick", "Royaume-Uni", 51.15, -0.19, "Europe/London"],
    [
      "IST",
      "Istanbul",
      "Istanbul Airport",
      "Turquie",
      41.26,
      28.74,
      "Europe/Istanbul",
    ],
    [
      "AMS",
      "Amsterdam",
      "Schiphol",
      "Pays-Bas",
      52.31,
      4.76,
      "Europe/Amsterdam",
    ],
    [
      "BRU",
      "Bruxelles",
      "Brussels Airport",
      "Belgique",
      50.9,
      4.48,
      "Europe/Brussels",
    ],
    [
      "FRA",
      "Francfort",
      "Frankfurt Airport",
      "Allemagne",
      50.04,
      8.56,
      "Europe/Berlin",
    ],
    ["BER", "Berlin", "Brandenburg", "Allemagne", 52.36, 13.5, "Europe/Berlin"],
    [
      "ATH",
      "Athènes",
      "Elefthérios Venizélos",
      "Grèce",
      37.94,
      23.95,
      "Europe/Athens",
    ],
    ["DSS", "Dakar", "Blaise Diagne", "Sénégal", 14.67, -17.07, "Africa/Dakar"],
    [
      "ABJ",
      "Abidjan",
      "Félix Houphouët-Boigny",
      "Côte d’Ivoire",
      5.26,
      -3.93,
      "Africa/Abidjan",
    ],
    [
      "YUL",
      "Montréal",
      "Pierre-Elliott-Trudeau",
      "Canada",
      45.47,
      -73.74,
      "America/Toronto",
    ],
    [
      "JFK",
      "New York",
      "John F. Kennedy",
      "États-Unis",
      40.64,
      -73.78,
      "America/New_York",
    ],
    [
      "EWR",
      "New York",
      "Newark Liberty",
      "États-Unis",
      40.69,
      -74.17,
      "America/New_York",
    ],
    [
      "DXB",
      "Dubaï",
      "Dubai International",
      "Émirats arabes unis",
      25.25,
      55.36,
      "Asia/Dubai",
    ],
    ["DOH", "Doha", "Hamad International", "Qatar", 25.27, 51.61, "Asia/Qatar"],
    [
      "BKK",
      "Bangkok",
      "Suvarnabhumi",
      "Thaïlande",
      13.69,
      100.75,
      "Asia/Bangkok",
    ],
    ["SIN", "Singapour", "Changi", "Singapour", 1.36, 103.99, "Asia/Singapore"],
    [
      "RUN",
      "Saint-Denis",
      "Roland-Garros",
      "La Réunion",
      -20.89,
      55.52,
      "Indian/Reunion",
    ],
    [
      "PTP",
      "Pointe-à-Pitre",
      "Pôle Caraïbes",
      "Guadeloupe",
      16.27,
      -61.53,
      "America/Guadeloupe",
    ],
  ];
  const airports = rows.map(([code, city, name, country, lat, lon, tz]) => ({
    code,
    city,
    name,
    country,
    lat,
    lon,
    tz,
  }));
  const airlines = [
    ["AZ", "ITA Airways", "#2459a7", "FCO"],
    ["AF", "Air France", "#172b68", "CDG"],
    ["TO", "Transavia", "#00836d", "ORY"],
    ["FR", "Ryanair", "#1a3471", "MAD"],
    ["VY", "Vueling", "#716600", "BCN"],
    ["U2", "easyJet", "#d44f00", "LGW"],
    ["AH", "Air Algérie", "#b51e32", "ALG"],
    ["AT", "Royal Air Maroc", "#ad1837", "CMN"],
    ["TU", "Tunisair", "#c02432", "TUN"],
    ["TP", "TAP Air Portugal", "#397625", "LIS"],
    ["TK", "Turkish Airlines", "#bf1524", "IST"],
    ["AC", "Air Canada", "#bb1828", "YUL"],
    ["EK", "Emirates", "#b51e32", "DXB"],
  ].map(([code, name, color, hub]) => ({ code, name, color, hub }));
  const airport = (code) => airports.find((a) => a.code === code);
  const normalize = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const search = (q = "") =>
    airports
      .filter((a) =>
        normalize(`${a.code} ${a.city} ${a.name} ${a.country}`).includes(
          normalize(q).trim(),
        ),
      )
      .slice(0, 8);
  function distance(a, b) {
    const rad = (n) => (n * Math.PI) / 180;
    const h =
      Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
      Math.cos(rad(a.lat)) *
        Math.cos(rad(b.lat)) *
        Math.sin(rad(b.lon - a.lon) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const dateInZone = (ms, tz) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  const time = (ms, code) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: airport(code).tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  function localUTC(date, hour, minute, tz) {
    const target = Date.parse(
      `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
    );
    let result = target;
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(result));
      const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
      const observed = Date.UTC(
        +p.year,
        +p.month - 1,
        +p.day,
        +p.hour,
        +p.minute,
        +p.second,
      );
      result += target - observed;
    }
    return result;
  }
  const duration = (m) =>
    `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
  const money = (n) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(n);
  const dateLabel = (date, long = false) =>
    new Intl.DateTimeFormat("fr-FR", {
      weekday: long ? "long" : "short",
      day: "numeric",
      month: long ? "long" : "short",
      year: long ? "numeric" : undefined,
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z"));
  function generate({ from, to, date }) {
    const a = airport(from),
      b = airport(to);
    if (!a || !b || from === to || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    let seed = Array.from(from + to + date).reduce(
      (s, c) => (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0,
      7,
    );
    const rnd = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const km = distance(a, b),
      long = km > 4600;
    const relevant = airlines.filter((c) => {
      if (c.code === "AF" || c.code === "TK") return true;
      if (c.code === "AC")
        return a.country === "Canada" || b.country === "Canada";
      if (c.code === "EK") return from === "DXB" || to === "DXB" || km > 7000;
      if (long) return c.code === "AT" || c.code === "TP";
      if (["AH", "AT", "TU"].includes(c.code))
        return [a.country, b.country].includes(
          { AH: "Algérie", AT: "Maroc", TU: "Tunisie" }[c.code],
        );
      return true;
    });
    const offers = [];
    for (let i = 0; i < 20; i++) {
      const carrier = relevant[i % relevant.length];
      const hub = airport(carrier.hub);
      const stop = i % 4 === 3 && hub.code !== from && hub.code !== to;
      const points = stop ? [a, hub, b] : [a, b];
      const depart = localUTC(
        date,
        6 + Math.floor((i * 16) / 20),
        Math.floor(rnd() * 12) * 5,
        a.tz,
      );
      if (depart < Date.now() + 60 * 60 * 1000) continue;
      let cursor = depart;
      const segments = [];
      for (let s = 0; s < points.length - 1; s++) {
        const mins =
          Math.round(
            ((distance(points[s], points[s + 1]) / 790) * 60 +
              35 +
              rnd() * 15) /
              5,
          ) * 5;
        const end = cursor + mins * 60000;
        segments.push({
          from: points[s].code,
          to: points[s + 1].code,
          departure: cursor,
          arrival: end,
          duration: mins,
          number: `${carrier.code} ${100 + Math.floor(rnd() * 8900)}`,
        });
        cursor =
          end +
          (s < points.length - 2
            ? (70 + Math.floor(rnd() * 10) * 10) * 60000
            : 0);
      }
      const totalDuration = (segments.at(-1).arrival - depart) / 60000;
      const low = ["FR", "TO", "U2", "VY"].includes(carrier.code);
      const price = Math.round(
        (28 + km * (long ? 0.066 : 0.075)) *
          (low ? 0.69 : 1.08) *
          (0.8 + rnd() * 0.65) *
          (stop ? 0.87 : 1),
      );
      offers.push({
        id: `${from}-${to}-${date}-${i}`,
        from,
        to,
        date,
        airline: carrier,
        segments,
        stops: stop ? 1 : 0,
        departure: depart,
        arrival: segments.at(-1).arrival,
        duration: totalDuration,
        price,
        departureHour: +time(depart, from).split(":")[0],
        cabin: "Économique",
        cabinBagIncluded: !low,
        departureTerminal: from === "CDG" ? "2F" : from === "ORY" ? "4" : "1",
        arrivalTerminal: to === "ALG" ? "I" : "1",
        punctuality: 90 + (i % 8),
        co2Kg: Math.round(km * (long ? 0.09 : 0.115) * (stop ? 1.22 : 1)),
        co2VsAverage: stop ? 8 : -18,
        payment_requirements: { requires_instant_payment: false },
        simulation: true,
      });
    }
    return offers;
  }
  function calendar({ from, to, month }) {
    const days = new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate();
    const entries = Array.from({ length: days }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      const direct = generate({ from, to, date }).filter(f => !f.stops);
      return { date, price: direct.length ? Math.min(...direct.map(f => f.price)) : null, direct: !!direct.length };
    });
    const prices = entries.map(d => d.price).filter(p => p !== null).sort((a,b) => a-b);
    return entries.map(d => ({ ...d, tier: d.price === null ? "unknown" : d.price <= prices[Math.floor(prices.length / 3)] ? "low" : d.price <= prices[Math.floor(prices.length * 2 / 3)] ? "medium" : "high" }));
  }
  function filter(
    offers,
    {
      max = Infinity,
      direct = false,
      baggage = false,
      carriers = [],
      periods = [],
      sort = "best",
    } = {},
  ) {
    const result = offers.filter(
      (f) =>
        f.price <= max &&
        (!direct || f.stops === 0) &&
        (!baggage || f.cabinBagIncluded) &&
        (!carriers.length || carriers.includes(f.airline.code)) &&
        (!periods.length ||
          periods.includes(
            f.departureHour < 12
              ? "morning"
              : f.departureHour < 18
                ? "afternoon"
                : "evening",
          )),
    );
    return result.sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "duration"
          ? a.duration - b.duration
          : a.price + a.duration * 0.32 - (b.price + b.duration * 0.32),
    );
  }
  const engine = {
    airports,
    airlines,
    airport,
    search,
    distance,
    time,
    dateInZone,
    localUTC,
    duration,
    money,
    dateLabel,
    generate,
    filter,
    calendar,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  else window.FlightEngine = engine;
})();
