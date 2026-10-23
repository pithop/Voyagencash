const crypto = require("node:crypto");
const F = require("../assets/js/flight-engine.js");
const { HttpError, sign, verify } = require("./http.js");
const { database } = require("./database.js");

const carriers = new Set(["FR", "U2", "W6", "W4", "TO", "HV", "VY"]);
// This is our private adapter contract, NOT Travelfusion's public XML API.
// The licensed adapter owns XML sessions, repricing, ProcessTerms and StartBooking.
function configured() {
  return !!(process.env.TRAVELFUSION_ADAPTER_URL && process.env.TRAVELFUSION_API_KEY);
}
function route(input) {
  const { from, to, date } = input;
  const count = Number(input.count ?? input.passengers?.length ?? 1);
  if (!/^[A-Z]{3}$/.test(from || "") || !/^[A-Z]{3}$/.test(to || "") || from === to ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      !Number.isInteger(count) || count < 1 || count > 9)
    throw new HttpError(400, "Trajet ou nombre de passagers invalide.");
  return { from, to, date, count };
}
function createRyanairDirectHandoffUrl(input) {
  const { from, to, date, count } = route(input);
  // Ryanair's search link supports route/date/count, not passenger identity or
  // guaranteed flight selection. Never put names, documents or email in a URL.
  const url = new URL("https://www.ryanair.com/fr/fr/trip/flights/select");
  url.search = new URLSearchParams({ adults: String(count), teens: "0", children: "0", infants: "0",
    dateOut: date, dateIn: "", isConnectedFlight: "false", discount: "0", promoCode: "",
    isReturn: "false", originIata: from, destinationIata: to, tpAdults: String(count),
    tpTeens: "0", tpChildren: "0", tpInfants: "0", tpStartDate: date, tpEndDate: "" }).toString();
  return url.href;
}
async function adapter(path, payload, key) {
  let base;
  try { base = new URL(process.env.TRAVELFUSION_ADAPTER_URL); } catch {}
  if (!base || base.protocol !== "https:" || base.username || base.password || base.search || base.hash)
    throw new HttpError(503, "L’adaptateur Travelfusion doit utiliser une adresse HTTPS valide.");
  const response = await fetch(new URL(path, base.href.replace(/\/?$/, "/")), {
    method: "POST", redirect: "error",
    headers: { Authorization: `Bearer ${process.env.TRAVELFUSION_API_KEY}`, "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(path === "search" ? 8000 : 15000),
  });
  if (!response.ok) throw new HttpError(502, "Le fournisseur low-cost n’a pas confirmé la demande.");
  return response.json();
}
async function searchLowCost(input) {
  const query = route(input);
  if (!configured()) return [];
  const data = await adapter("search", { ...query, currency: "EUR", carriers: [...carriers] });
  if (!Array.isArray(data.offers)) throw new HttpError(502, "Réponse low-cost invalide.");
  return data.offers.filter(o => carriers.has(o.airline?.code) && o.currency === "EUR" &&
    typeof o.id === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(o.id) &&
    o.from === query.from && o.to === query.to && o.date === query.date &&
    Number.isFinite(o.totalAmount) && o.totalAmount > 0 &&
    Number.isFinite(Date.parse(o.expiresAt)) && Date.parse(o.expiresAt) > Date.now() &&
    Array.isArray(o.segments) && o.segments.length && o.segments.every(s =>
      F.airport(s.from) && F.airport(s.to) && Number.isFinite(s.departure) &&
      Number.isFinite(s.arrival) && s.arrival > s.departure)
  ).map(o => {
    const segments = o.segments.map(s => ({ ...s, duration: (s.arrival - s.departure) / 60000 }));
    const departure = segments[0].departure, arrival = segments.at(-1).arrival;
    return F.enrichOffer({ ...o, id: `tf_${o.id}`, provider: "travelfusion", simulation: false, priceKind: "quoted", observedAt: Date.now(),
      price: o.totalAmount / query.count, segments, departure, arrival,
      stops: segments.length - 1, duration: (arrival - departure) / 60000,
      departureHour: +F.time(departure, query.from).split(":")[0],
      payment_requirements: { requires_instant_payment: true },
      bookingToken: sign({ kind: "low-cost-offer", offerId: o.id, ...query,
        airline: o.airline.code, amountCents: Math.round(o.totalAmount * 100),
        expiresAt: Date.parse(o.expiresAt) }),
    });
  });
}
function encryptionKey() {
  const value = process.env.CONCIERGE_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(value || "") || !process.env.VOUCHER_SIGNING_SECRET)
    throw new HttpError(503, "Le chiffrement et la signature de la conciergerie doivent être configurés.");
  return Buffer.from(value, "hex");
}
function encrypt(data, id, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(id));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") };
}
function passengersFor(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 9)
    throw new HttpError(400, "De 1 à 9 passagers adultes sont requis.");
  return input.map(p => {
    if (!/^[\p{L}\p{M} '\-]{2,60}$/u.test(p.given_name || "") ||
        !/^[\p{L}\p{M} '\-]{2,60}$/u.test(p.family_name || "") ||
        !/^\S{1,100}@\S{1,100}\.\S{1,30}$/.test(p.email || "") ||
        !/^\+\d{8,15}$/.test(p.phone_number || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.born_on || "") ||
        !Number.isFinite(Date.parse(p.born_on)) || new Date(p.born_on).toISOString().slice(0, 10) !== p.born_on ||
        p.born_on < "1900-01-01" || Date.parse(p.born_on) > Date.now() - 18 * 365.25 * 86400000)
      throw new HttpError(400, "Informations passager adulte invalides.");
    if ((p.gender !== undefined && !["m", "f"].includes(p.gender)) ||
        (p.title !== undefined && !["mr", "ms", "mrs", "miss", "dr"].includes(p.title)))
      throw new HttpError(400, "Civilité ou sexe du passager invalide.");
    return Object.fromEntries(["given_name", "family_name", "born_on", "email", "phone_number", "title", "gender"].filter(k => p[k] !== undefined).map(k => [k, p[k]]));
  });
}
function publicBooking(row) {
  return { id: row.id, status: row.state, provider: row.provider, simulation: false,
    bookingReference: row.booking_reference || null, handoffUrl: row.handoff_url || null,
    accessToken: sign({ kind: "low-cost-access", id: row.id, expiresAt: new Date(row.expires_at).getTime() }),
    message: row.state === "failed" ? "La réservation a échoué. Aucun billet confirmé." : row.state === "concierge_pending" ? "Demande enregistrée en conciergerie. Aucun billet émis ni tarif garanti." :
      row.state === "confirmed" ? "Réservation confirmée par la compagnie." : "Confirmation fournisseur en attente. Ne créez pas une nouvelle demande." };
}
function providerStatus(data) {
  if (!data || !["pending", "confirmed", "failed"].includes(data.status) ||
      (data.status === "confirmed" && !/^[A-Za-z0-9-]{4,30}$/.test(data.bookingReference || "")))
    throw new HttpError(502, "Confirmation fournisseur invalide.");
  return data;
}
async function bookFlight(input) {
  const passengers = passengersFor(input.passengers);
  const query = route({ ...input, count: input.count ?? passengers.length });
  if (query.count !== passengers.length || query.date < new Date().toISOString().slice(0, 10) ||
      query.date > new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))
    throw new HttpError(400, "Date ou passagers incohérents.");
  const airline = input.airline || "FR";
  if (!carriers.has(airline) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey || ""))
    throw new HttpError(400, "Compagnie ou clé d’idempotence invalide.");
  const flightNumber = String(input.flightNumber || "").trim();
  if (flightNumber && !/^[A-Z0-9]{2}\s?\d{1,5}$/.test(flightNumber))
    throw new HttpError(400, "Numéro de vol invalide.");
  const key = encryptionKey();
  const payload = { ...query, airline, flightNumber, passengers, bookingToken: input.bookingToken || null,
    expectedAmountCents: input.expectedAmountCents ?? null };
  const fingerprint = crypto.createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
  const db = database();
  const saved = (await db.query("SELECT * FROM low_cost_bookings WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0];
  if (saved) {
    if (saved.fingerprint !== fingerprint) throw new HttpError(409, "Clé réutilisée pour une autre demande.");
    return publicBooking(saved);
  }
  const live = configured() && !!input.bookingToken;
  let offer;
  if (live) {
    if (process.env.TRAVELFUSION_BOOKING_ENABLED !== "true")
      throw new HttpError(503, "L’émission Travelfusion n’est pas activée.");
    offer = verify(input.bookingToken, "low-cost-offer");
    if (offer.from !== query.from || offer.to !== query.to || offer.date !== query.date ||
        offer.count !== query.count || offer.airline !== airline || offer.amountCents !== input.expectedAmountCents)
      throw new HttpError(409, "L’offre et le montant doivent être reconfirmés.");
  }
  const id = "lcc_" + crypto.randomUUID();
  const handoffUrl = airline === "FR" && !live ? createRyanairDirectHandoffUrl(query) : null;
  const { rows } = await db.query(
    "INSERT INTO low_cost_bookings(id,idempotency_key,fingerprint,provider,state,encrypted_payload,handoff_url,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *",
    [id, input.idempotencyKey, fingerprint, live ? "travelfusion" : "concierge", live ? "submitting" : "concierge_pending",
      encrypt(payload, id, key), handoffUrl, new Date(Date.now() + 30 * 86400000)],
  );
  if (!rows.length) {
    const row = (await db.query("SELECT * FROM low_cost_bookings WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0];
    if (!row || row.fingerprint !== fingerprint) throw new HttpError(409, "Demande concurrente différente.");
    return publicBooking(row);
  }
  if (!live) return publicBooking(rows[0]);
  // Persist the claim BEFORE the provider call. Any timeout is ambiguous: never
  // automatically retry StartBooking or downgrade it to a concierge purchase.
  let result;
  try {
    result = providerStatus(await adapter("bookings", { clientReference: id, offerId: offer.offerId,
      expectedAmountCents: offer.amountCents, currency: "EUR", passengers }, input.idempotencyKey));
  } catch {
    result = { status: "reconciliation_required" };
  }
  const updated = await db.query("UPDATE low_cost_bookings SET state=$2,booking_reference=$3,updated_at=now() WHERE id=$1 AND state IN ('submitting','pending','reconciliation_required') RETURNING *",
    [id, result.status, result.bookingReference || null]);
  return publicBooking(updated.rows[0] || (await db.query("SELECT * FROM low_cost_bookings WHERE id=$1", [id])).rows[0]);
}
async function checkBookingStatus({ token, readOnly = false }) {
  const access = verify(token, "low-cost-access");
  const db = database();
  let row = (await db.query("SELECT * FROM low_cost_bookings WHERE id=$1", [access.id])).rows[0];
  if (!row) throw new HttpError(404, "Demande introuvable.");
  if (!readOnly && row.provider === "travelfusion" && ["pending", "submitting", "reconciliation_required"].includes(row.state) && configured()) {
    // Status lookup by our durable clientReference also reconciles a lost response.
    const result = providerStatus(await adapter("bookings/status", { clientReference: row.id }));
    row = (await db.query("UPDATE low_cost_bookings SET state=$2,booking_reference=$3,updated_at=now() WHERE id=$1 AND state IN ('pending','submitting','reconciliation_required') RETURNING *",
      [row.id, result.status, result.bookingReference || null])).rows[0] ||
      (await db.query("SELECT * FROM low_cost_bookings WHERE id=$1", [row.id])).rows[0];
  }
  return { ...publicBooking(row), accessToken: token };
}
module.exports = { configured, searchLowCost, bookFlight, checkBookingStatus, createRyanairDirectHandoffUrl };
