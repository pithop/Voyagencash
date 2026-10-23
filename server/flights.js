const F = require("../assets/js/flight-engine.js");
const { HttpError } = require("./http.js");
const ryanair = require("./ryanair.js");
const travelfusion = require("./travelfusion.js");
const observations = new Map();
const demoCalendars = new Map();
function validate(input, calendar = false) {
  const { from, to } = input;
  if (!F.airport(from) || !F.airport(to) || from === to)
    throw new HttpError(400, "Choisissez deux aéroports différents.");
  const count = Number(input.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 9)
    throw new HttpError(400, "De 1 à 9 passagers adultes sont acceptés.");
  const today = new Date().toISOString().slice(0, 10),
    max = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  if (calendar) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month || "") ||
      input.month < today.slice(0, 7) ||
      input.month > max.slice(0, 7)
    )
      throw new HttpError(400, "Mois hors des 12 prochains mois.");
    return { from, to, month: input.month, count };
  }
  const date = input.date;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    date < today ||
    date > max
  )
    throw new HttpError(400, "Date invalide ou hors des 12 prochains mois.");
  return { from, to, date, count };
}
async function duffel(path, data, method = data ? "POST" : "GET", timeoutMs = 12000) {
  let response;
  try {
    response = await fetch("https://api.duffel.com" + path, {
      method, redirect: "error",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_API_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(data ? { body: JSON.stringify({ data }) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HttpError(
      504,
      "Le fournisseur de vols ne répond pas. Réessayez.",
    );
  }
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      "Le fournisseur ne peut pas traiter cette demande. Réessayez.",
    );
  return (await response.json()).data;
}
function localTimestamp(value, code) {
  const [date, clock] = value.split("T");
  const [h, m] = clock.split(":").map(Number);
  return /Z$|[+-]\d\d:\d\d$/.test(value)
    ? Date.parse(value)
    : F.localUTC(date, h, m, F.airport(code).tz);
}
function normalize(offer, query) {
  if (offer.total_currency !== "EUR" || offer.slices.length !== 1) return null;
  const segments = offer.slices[0].segments.map((s) => ({
    from: s.origin.iata_code,
    to: s.destination.iata_code,
    departure: localTimestamp(s.departing_at, s.origin.iata_code),
    arrival: localTimestamp(s.arriving_at, s.destination.iata_code),
    number: `${s.marketing_carrier.iata_code} ${s.marketing_carrier_flight_number}`,
    duration: 0,
    aircraft: s.aircraft?.name,
    operatingCarrier: s.operating_carrier?.iata_code,
  }));
  segments.forEach((s) => (s.duration = (s.arrival - s.departure) / 60000));
  const c = offer.owner,
    airline = { code: c.iata_code || "XX", name: c.name, color: "#016bfd" };
  const bag = offer.slices[0].segments.every((s) =>
    s.passengers?.every((p) =>
      p.baggages?.some((b) => b.type === "carry_on" && b.quantity > 0),
    ),
  );
  return {
    id: offer.id,
    from: query.from,
    to: query.to,
    date: query.date,
    airline,
    segments,
    departure: segments[0].departure,
    arrival: segments.at(-1).arrival,
    duration: (segments.at(-1).arrival - segments[0].departure) / 60000,
    stops: segments.length - 1,
    departureHour: +F.time(segments[0].departure, query.from).split(":")[0],
    price: Number(offer.total_amount) / query.count,
    totalAmount: Number(offer.total_amount),
    currency: "EUR",
    cabin: "Économique",
    cabinBagIncluded: bag,
    co2Kg: offer.total_emissions_kg ? Number(offer.total_emissions_kg) : null,
    punctuality: null,
    simulation: false,
    priceKind: "quoted",
    provider: "duffel",
    expiresAt: offer.expires_at,
    payment_requirements: offer.payment_requirements,
    passengerIds: offer.passengers.map((p) => p.id),
  };
}
async function search(query) {
  if (!process.env.DUFFEL_API_TOKEN && !travelfusion.configured())
    return { source: "demo", simulation: true, offers: F.generate(query) };
  const providers = [];
  if (process.env.DUFFEL_API_TOKEN) providers.push({ name: "duffel", run: async () => {
    const data = await duffel("/air/offer_requests?return_offers=true", {
      slices: [{ origin: query.from, destination: query.to, departure_date: query.date }],
      passengers: Array.from({ length: query.count }, () => ({ type: "adult" })), cabin_class: "economy",
    }, "POST", 8000);
    if (!Array.isArray(data?.offers)) throw new HttpError(502, "Réponse fournisseur invalide.");
    return data.offers.flatMap(o => {
      try {
        if (!o.slices?.[0]?.segments?.length || !o.slices[0].segments.every(s =>
          F.airport(s.origin?.iata_code) && F.airport(s.destination?.iata_code))) return [];
        const offer = normalize(o, query);
        return offer && Number.isFinite(offer.price) && offer.price > 0 && Date.parse(offer.expiresAt) > Date.now()
          ? [{ ...offer, observedAt: Date.now() }] : [];
      } catch { return []; }
    });
  } });
  if (travelfusion.configured()) providers.push({ name: "travelfusion", run: () => travelfusion.searchLowCost(query) });
  providers.push({ name: "ryanair", run: () => ryanair.search(query) });
  const results = await Promise.allSettled(providers.map(p => p.run()));
  const available = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  if (!available.length && results.some(r => r.status === "rejected"))
    throw new HttpError(502, "Un fournisseur est indisponible. Réessayez la recherche.");
  const unique = [...new Map(available.map(o => [`${o.provider}:${o.id}`, o])).values()];
  const offers = unique.map(F.enrichOffer).sort(
    (a, b) => a.price - b.price,
  );
  const direct = offers.filter(o => !o.stops);
  // The displayed direct minimum inherits the winning offer's provenance, never a different source's.
  const cheapest = direct.reduce((best, o) => !best || o.price < best.price ? o : best, null);
  if (observations.size >= 1000) observations.delete(observations.keys().next().value);
  observations.set(`${query.from}:${query.to}:${query.count}:${query.date}`, {
    date: query.date, price: cheapest?.price ?? null, direct: !!direct.length,
    observedAt: Date.now(), expiresAt: cheapest?.expiresAt || new Date(Date.now() + 900000).toISOString(),
    priceKind: cheapest?.priceKind || "unknown", provider: cheapest?.provider || null,
  });
  if (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) {
    const key = `${query.from}:${query.to}:${query.count}:${query.date}`;
    try {
      await require("./database.js")
        .database()
        .query(
          "INSERT INTO fare_observations(route_key,value) VALUES($1,$2) ON CONFLICT(route_key) DO UPDATE SET value=$2,observed_at=now()",
          [key, observations.get(key)],
        );
    } catch {
      /* Availability is returned even if the optional fare cache is unavailable. */
    }
  }
  return { source: offers.some(o => o.provider === "duffel") ? "duffel" : offers[0]?.provider || "live",
    simulation: false, offers, partial: results.some(r => r.status === "rejected"),
    providers: providers.map((p, i) => ({ name: p.name, status: results[i].status === "rejected" ? "unavailable" : "available" })) };
}

async function calendar(query) {
  if (!process.env.DUFFEL_API_TOKEN && !travelfusion.configured()) {
    const key = `${query.from}:${query.to}:${query.month}:${query.count}`;
    let cached = demoCalendars.get(key);
    // Short-lived because today's departing flights disappear as time advances.
    if (!cached || Date.now() - cached.at >= 60000) {
      cached = { at: Date.now(), days: F.calendar(query) };
      if (demoCalendars.size >= 128) demoCalendars.delete(demoCalendars.keys().next().value);
      demoCalendars.set(key, cached);
    }
    return { source: "demo", simulation: true, days: cached.days };
  }
  if (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) {
    try {
      const { rows } = await require("./database.js")
        .database()
        .query(
          "SELECT route_key,value FROM fare_observations WHERE route_key LIKE $1 AND observed_at > now()-interval '15 minutes'",
          [`${query.from}:${query.to}:${query.count}:${query.month}%`],
        );
      for (const r of rows) {
        if (!observations.has(r.route_key) || observations.get(r.route_key).observedAt < r.value.observedAt)
          observations.set(r.route_key, r.value);
      }
    } catch {
      /* Unknown prices remain unknown. */
    }
  }
  try {
    const rf = await ryanair.calendarFares(query.from, query.to, query.month);
    if (rf && rf.size) {
      for (const [dStr, fInfo] of rf) {
        const key = `${query.from}:${query.to}:${query.count}:${dStr}`;
        const existing = observations.get(key);
        // Ne jamais ecraser un prix quoted ferme par un tarif indicatif
        const fresh = existing && Date.now() - existing.observedAt < 900000 &&
          (!existing.expiresAt || Date.parse(existing.expiresAt) > Date.now());
        const canUpdate = !fresh || existing.price === null;
        if (canUpdate) {
          observations.set(key, {
            date: dStr,
            price: fInfo.price,
            direct: true,
            observedAt: fInfo.observedAt || Date.now(),
            priceKind: "indicative",
            provider: "ryanair",
          });
        }
      }
    }
  } catch {
    /* Best effort */
  }
  while (observations.size > 1000) observations.delete(observations.keys().next().value);
  const length = new Date(
    +query.month.slice(0, 4),
    +query.month.slice(5),
    0,
  ).getDate();
  const days = Array.from({ length }, (_, i) => {
    const date = `${query.month}-${String(i + 1).padStart(2, "0")}`;
    const value = observations.get(
      `${query.from}:${query.to}:${query.count}:${date}`,
    );
    return value && Date.now() - value.observedAt < 900000 && (!value.expiresAt || Date.parse(value.expiresAt) > Date.now())
      ? { ...value }
      : { date, price: null, direct: null };
  });
  const prices = days
    .filter((d) => d.price !== null)
    .map((d) => d.price)
    .sort((a, b) => a - b);
  return {
    source: "duffel-cache",
    simulation: false,
    days: days.map((d) => ({
      ...d,
      tier:
        d.price === null
          ? "unknown"
          : prices.length < 3
            ? "medium"
            : d.price <= prices[Math.floor(prices.length / 3)]
              ? "low"
              : d.price <= prices[Math.floor((prices.length * 2) / 3)]
                ? "medium"
                : "high",
    })),
  };
}
const inflightSearches = new Map(), inflightCalendars = new Map();
function shared(map, query, run) {
  const key = JSON.stringify([query.from, query.to, query.count || 1, query.date || query.month]);
  if (!map.has(key)) map.set(key, Promise.resolve().then(() => run(query)).finally(() => map.delete(key)));
  return map.get(key);
}
module.exports = { validate, duffel, search: q => shared(inflightSearches, q, search), calendar: q => shared(inflightCalendars, q, calendar) };
