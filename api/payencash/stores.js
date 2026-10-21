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
    .map((s, i) => ({
      id: i + 1,
      name: s.name.slice(0, 100),
      city: s.city.slice(0, 80),
      zip: s.zip.slice(0, 12),
      area: s.address.slice(0, 180),
      lat: s.lat,
      lon: s.lon,
      hours:
        typeof s.hours === "string"
          ? s.hours.slice(0, 160)
          : "Horaires à confirmer",
    }));
  json(res, 200, { source: "partner", stores });
});
