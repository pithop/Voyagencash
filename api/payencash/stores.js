const { endpoint, json, HttpError } = require("../../server/http.js");
module.exports = endpoint("GET", async (req, res) => {
  if (!process.env.PAYENCASH_ADAPTER_URL || !process.env.PAYENCASH_API_KEY)
    return json(res, 200, { source: "unconfigured", stores: [] });
  const base = new URL(process.env.PAYENCASH_ADAPTER_URL);
  if (base.protocol !== "https:")
    throw new HttpError(503, "Adaptateur HTTPS requis.");
  const response = await fetch(
    new URL(
      "stores",
      base.href.endsWith("/") ? base : new URL(base.href + "/"),
    ),
    {
      headers: { Authorization: `Bearer ${process.env.PAYENCASH_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new HttpError(502, "Annuaire partenaire indisponible.");
  const data = await response.json();
  if (!Array.isArray(data.stores))
    throw new HttpError(502, "Annuaire partenaire invalide.");
  function evaluateHours(hoursStr) {
    if (!hoursStr || typeof hoursStr !== "string") return { isOpen: true, status: "unknown", closesInMinutes: null };
    const match = hoursStr.match(/(\d{1,2})[h:](\d{2})?\s*[-–à]\s*(\d{1,2})[h:](\d{2})?/i);
    if (!match) return { isOpen: true, status: "unknown", closesInMinutes: null };
    const openH = parseInt(match[1], 10);
    const openM = match[2] ? parseInt(match[2], 10) : 0;
    const closeH = parseInt(match[3], 10);
    const closeM = match[4] ? parseInt(match[4], 10) : 0;
    try {
      const parisTimeStr = new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour12: false });
      const [curH, curM] = parisTimeStr.split(":").map(Number);
      const curMinutes = curH * 60 + curM;
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      if (curMinutes >= openMinutes && curMinutes < closeMinutes) {
        const remaining = closeMinutes - curMinutes;
        return {
          isOpen: true,
          status: remaining <= 60 ? "closing_soon" : "open",
          closesInMinutes: remaining,
        };
      }
      return { isOpen: false, status: "closed", closesInMinutes: 0 };
    } catch {
      return { isOpen: true, status: "unknown", closesInMinutes: null };
    }
  }

  const stores = data.stores
    .slice(0, 10000)
    .filter(
      (s) =>
        typeof s.name === "string" &&
        typeof s.city === "string" &&
        typeof s.zip === "string" &&
        typeof s.address === "string" &&
        Number.isFinite(s.lat) &&
        Math.abs(s.lat) <= 90 &&
        Number.isFinite(s.lon) &&
        Math.abs(s.lon) <= 180,
    )
    .map((s, i) => {
      const hours = typeof s.hours === "string" ? s.hours.slice(0, 160) : "Horaires à confirmer";
      const schedule = evaluateHours(hours);
      return {
        id: s.id || (i + 1),
        name: s.name.slice(0, 100),
        city: s.city.slice(0, 80),
        zip: s.zip.slice(0, 12),
        area: s.address.slice(0, 180),
        lat: s.lat,
        lon: s.lon,
        hours,
        isOpen: schedule.isOpen,
        openStatus: schedule.status,
        closesInMinutes: schedule.closesInMinutes,
      };
    });
  json(res, 200, { source: "partner", stores });
});
