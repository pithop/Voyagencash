const F = require("../assets/js/flight-engine.js");

const fareCache = new Map();
const scheduleCache = new Map();
const FARE_TTL = 15 * 60 * 1000; // 15 mins
const SCHED_TTL = 60 * 60 * 1000; // 1 hour

async function fetchFares(from, to, month) {
  const cacheKey = `${from}:${to}:${month}`;
  const hit = fareCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FARE_TTL) {
    return hit.fares;
  }

  try {
    const url = `https://www.ryanair.com/api/farfnd/v4/oneWayFares/${from}/${to}/cheapestPerDay?outboundMonthOfDate=${month}-01&currency=EUR`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Voyagencash/2.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const fares = new Map();
    const rawFares = data?.outbound?.fares || [];
    for (const item of rawFares) {
      if (item.day && item.price && !item.unavailable && !item.soldOut) {
        const val = typeof item.price.value === "number" ? item.price.value : null;
        if (val !== null) {
          fares.set(item.day, {
            price: Math.round(val * 100) / 100,
            departureDate: item.departureDate,
            arrivalDate: item.arrivalDate,
          });
        }
      }
    }
    if (fareCache.size > 200) fareCache.delete(fareCache.keys().next().value);
    fareCache.set(cacheKey, { at: Date.now(), fares });
    return fares;
  } catch {
    return null;
  }
}

async function fetchSchedules(from, to, year, monthNumber) {
  const cacheKey = `${from}:${to}:${year}:${monthNumber}`;
  const hit = scheduleCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SCHED_TTL) {
    return hit.days;
  }

  try {
    const url = `https://www.ryanair.com/api/timtbl/3/schedules/${from}/${to}/years/${year}/months/${monthNumber}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Voyagencash/2.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const days = new Map();
    for (const d of data?.days || []) {
      if (d.day && Array.isArray(d.flights) && d.flights.length) {
        days.set(d.day, d.flights);
      }
    }
    if (scheduleCache.size > 200) scheduleCache.delete(scheduleCache.keys().next().value);
    scheduleCache.set(cacheKey, { at: Date.now(), days });
    return days;
  } catch {
    return null;
  }
}

async function search(query) {
  if (process.env.VOYAGENCASH_TEST_MODE === "true") return [];
  const { from, to, date, count = 1 } = query;
  if (!F.airport(from) || !F.airport(to)) return [];

  const [year, month, dayStr] = (date || "").split("-");
  if (!year || !month || !dayStr) return [];
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(dayStr, 10);

  const [faresMap, schedulesMap] = await Promise.all([
    fetchFares(from, to, `${year}-${month}`),
    fetchSchedules(from, to, year, monthNum),
  ]);

  if (!faresMap || !faresMap.has(date)) return [];
  const fareInfo = faresMap.get(date);
  const unitPrice = fareInfo.price;
  const flights = schedulesMap?.get(dayNum) || [];

  const originAirport = F.airport(from);
  const destAirport = F.airport(to);
  const km = F.distance(originAirport, destAirport);
  const co2Kg = Math.round(km * 0.088);

  const offers = [];

  const createOffer = (flightNumber, depClock, arrClock) => {
    const [depH, depM] = depClock.split(":").map(Number);
    const [arrH, arrM] = arrClock.split(":").map(Number);
    const departure = F.localUTC(date, depH, depM, originAirport.tz);
    let arrival = F.localUTC(date, arrH, arrM, destAirport.tz);
    if (arrival <= departure) arrival += 86400000;
    const duration = Math.round((arrival - departure) / 60000);

    const fullNumber = flightNumber.startsWith("FR") ? flightNumber : `FR ${flightNumber}`;

    return {
      id: `fr_${from}_${to}_${date}_${flightNumber.replace(/\s+/g, "")}_${Math.round(unitPrice * 100)}`,
      from,
      to,
      date,
      airline: {
        code: "FR",
        name: "Ryanair",
        color: "#1a3471",
      },
      segments: [
        {
          from,
          to,
          departure,
          arrival,
          duration,
          number: fullNumber,
        },
      ],
      departure,
      arrival,
      duration,
      stops: 0,
      departureHour: +F.time(departure, from).split(":")[0],
      price: unitPrice,
      totalAmount: Math.round(unitPrice * count * 100) / 100,
      currency: "EUR",
      cabin: "Économique",
      cabinBagIncluded: false,
      co2Kg,
      co2Estimated: true,
      punctuality: null,
      simulation: false,
      provider: "ryanair-indicative",
      conciergeAvailable: true,
      payment_requirements: { requires_instant_payment: true },
      passengerIds: Array.from({ length: count }, (_, i) => `fr_pas_${i + 1}`),
    };
  };

  if (flights.length > 0) {
    for (const f of flights) {
      if (f.departureTime && f.arrivalTime) {
        offers.push(createOffer(f.number, f.departureTime, f.arrivalTime));
      }
    }
  } else if (fareInfo?.departureDate && fareInfo?.arrivalDate) {
    const depClock = fareInfo.departureDate.slice(11, 16);
    const arrClock = fareInfo.arrivalDate.slice(11, 16);
    offers.push(createOffer("FR", depClock, arrClock));
  }

  return offers;
}

async function calendarFares(from, to, month) {
  if (process.env.VOYAGENCASH_TEST_MODE === "true") return null;
  return fetchFares(from, to, month);
}

module.exports = {
  fetchFares,
  fetchSchedules,
  search,
  calendarFares,
};
