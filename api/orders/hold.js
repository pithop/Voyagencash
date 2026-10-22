const crypto = require("node:crypto");
const {
  endpoint,
  body,
  json,
  HttpError,
  sign,
} = require("../../server/http.js");
const { validate, duffel } = require("../../server/flights.js");
const F = require("../../assets/js/flight-engine.js");
const { database, transaction } = require("../../server/database.js");
module.exports = endpoint("POST", async (req, res) => {
  const input = await body(req);
  if (input.offerId?.startsWith("fr_")) {
    const passengers = Array.isArray(input.passengers) ? input.passengers : [];
    const count = passengers.length || Number(input.count ?? 1);
    const parts = input.offerId.split("_");
    const priceCents = parseInt(parts.at(-1), 10) || 8199;
    const amount = Math.round(
      priceCents * count +
      (input.options?.baggage === true ? 3500 * count : 0) +
      (input.options?.guarantee === true ? 1900 * count : 0)
    );
    const orderId = `vnc_${input.offerId.slice(3, 15)}_${crypto.randomBytes(4).toString("hex")}`;
    const expiresAt = Date.now() + 7200000;
    const hold = {
      kind: "hold",
      id: orderId,
      amountCents: amount,
      currency: "EUR",
      expiresAt,
      simulation: true,
      airline: "Ryanair",
    };
    const response = {
      ...hold,
      token: sign(hold),
      accessToken: sign({
        kind: "order-access",
        id: orderId,
        expiresAt: Date.now() + 90 * 86400000,
      }),
      payment_required_by: new Date(expiresAt).toISOString(),
      bookingReference: "VNC-" + orderId.slice(-6).toUpperCase(),
    };
    if (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) {
      try {
        await database().query(
          "INSERT INTO flight_orders(id,amount_cents,currency,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [hold.id, hold.amountCents, hold.currency, new Date(expiresAt)],
        );
      } catch {}
    }
    return json(res, 201, response);
  }
  if (!process.env.DUFFEL_API_TOKEN) {
    if (
      !Array.isArray(input.legs) ||
      input.legs.length < 1 ||
      input.legs.length > 4
    )
      throw new HttpError(400, "De 1 à 4 trajets requis.");
    const count = Number(input.count ?? 1);
    const flights = input.legs.map((l) => {
      const q = validate({ ...l, count });
      const f = F.generate(q).find((f) => f.id === l.offerId);
      if (!f) throw new HttpError(409, "Offre expirée ou inconnue.");
      return f;
    });
    for (let i = 1; i < flights.length; i++)
      if (flights[i].departure < flights[i - 1].arrival + 7200000)
        throw new HttpError(400, "Correspondance impossible.");
    const amount = Math.round(
      (flights.reduce((s, f) => s + f.price * count, 0) +
        (input.options?.baggage === true ? 35 * count * flights.length : 0) +
        (input.options?.guarantee === true ? 19 * count : 0)) *
        100,
    );
    const hold = {
      kind: "hold",
      id: "demo_" + crypto.randomUUID(),
      amountCents: amount,
      currency: "EUR",
      expiresAt: Date.now() + 7200000,
      simulation: true,
    };
    return json(res, 201, {
      ...hold,
      token: sign(hold),
      payment_required_by: new Date(hold.expiresAt).toISOString(),
    });
  }
  if (
    process.env.LIVE_CHECKOUT_ENABLED !== "true" ||
    !process.env.PAYENCASH_WEBHOOK_SECRET
  )
    throw new HttpError(503, "Le paiement partenaire n’est pas encore activé.");
  const key = req.headers["idempotency-key"];
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key || "",
    )
  )
    throw new HttpError(400, "Clé d’idempotence UUID v4 requise.");
  if (!/^off_[A-Za-z0-9]+$/.test(input.offerId || "") && !/^fr_[A-Za-z0-9_-]+$/.test(input.offerId || ""))
    throw new HttpError(400, "Offre de vol invalide.");
  if (
    !Array.isArray(input.passengers) ||
    input.passengers.length < 1 ||
    input.passengers.length > 9
  )
    throw new HttpError(400, "Passagers manquants.");
  const passengers = input.passengers.map((p) => {
    if (
      !/^[\p{L}\p{M} '\-]{2,60}$/u.test(p.given_name || "") ||
      !/^[\p{L}\p{M} '\-]{2,60}$/u.test(p.family_name || "") ||
      !/^(pas|fr_pas)_[A-Za-z0-9_]+$/.test(p.id || "") ||
      !["m", "f"].includes(p.gender) ||
      !["mr", "ms", "mrs", "miss", "dr"].includes(p.title) ||
      !/^\+\d{8,15}$/.test(p.phone_number || "") ||
      !/^\S+@\S+\.\S+$/.test(p.email || "")
    )
      throw new HttpError(400, "Informations passager invalides.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.born_on || "") ||
      !Number.isFinite(Date.parse(p.born_on)) ||
      new Date(p.born_on).toISOString().slice(0, 10) !== p.born_on ||
      p.born_on >
        new Date(Date.now() - 18 * 365.25 * 86400000)
          .toISOString()
          .slice(0, 10) ||
      p.born_on < "1900-01-01"
    )
      throw new HttpError(
        400,
        "Seuls les passagers adultes sont pris en charge.",
      );
    return Object.fromEntries(
      [
        "id",
        "given_name",
        "family_name",
        "born_on",
        "gender",
        "title",
        "phone_number",
        "email",
      ].map((k) => [k, p[k]]),
    );
  });
  // The adapter is an operator-owned contract, not a guessed public PayEnCash API.
  if (
    !process.env.PAYENCASH_ADAPTER_URL ||
    !process.env.PAYENCASH_API_KEY ||
    !process.env.VOUCHER_SIGNING_SECRET
  )
    throw new HttpError(
      503,
      "Le service de paiement partenaire doit être configuré avant toute retenue.",
    );
  let adapter;
  try { adapter = new URL(process.env.PAYENCASH_ADAPTER_URL); } catch {}
  if (adapter?.protocol !== "https:")
    throw new HttpError(503, "L’adaptateur partenaire doit utiliser HTTPS.");
  const db = database();
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        offerId: input.offerId,
        passengers,
        expectedAmountCents: input.expectedAmountCents,
      }),
    )
    .digest("hex");
  const inserted = await db.query(
    "INSERT INTO checkout_requests(idempotency_key,fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *",
    [key, fingerprint],
  );
  if (!inserted.rowCount) {
    const {
      rows: [saved],
    } = await db.query(
      "SELECT * FROM checkout_requests WHERE idempotency_key=$1",
      [key],
    );
    if (saved.fingerprint !== fingerprint)
      throw new HttpError(409, "Clé réutilisée pour une autre demande.");
    if (saved.response) return json(res, 200, saved.response);
    throw new HttpError(
      409,
      "Création en cours ou à rapprocher avec Duffel. Ne renvoyez pas une nouvelle clé.",
    );
  }
  if (input.offerId.startsWith("fr_")) {
    const parts = input.offerId.split("_");
    const priceCents = parseInt(parts.at(-1), 10) || 8199;
    const count = passengers.length;
    const amount = Math.round(
      priceCents * count +
      (input.options?.baggage === true ? 3500 * count : 0) +
      (input.options?.guarantee === true ? 1900 * count : 0)
    );
    const orderId = `vnc_${input.offerId.slice(3, 15)}_${crypto.randomBytes(4).toString("hex")}`;
    const expiresAt = Date.now() + 7200000;
    const hold = {
      kind: "hold",
      id: orderId,
      amountCents: amount,
      currency: "EUR",
      expiresAt,
      simulation: true,
      airline: "Ryanair",
    };
    const response = {
      ...hold,
      token: sign(hold),
      accessToken: sign({
        kind: "order-access",
        id: orderId,
        expiresAt: Date.now() + 90 * 86400000,
      }),
      payment_required_by: new Date(expiresAt).toISOString(),
      bookingReference: "VNC-" + orderId.slice(-6).toUpperCase(),
    };
    await transaction(async (databaseClient) => {
      await databaseClient.query(
        "INSERT INTO flight_orders(id,amount_cents,currency,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [hold.id, hold.amountCents, hold.currency, new Date(expiresAt)],
      );
      await databaseClient.query(
        "UPDATE checkout_requests SET state='held',response=$2 WHERE idempotency_key=$1",
        [key, response],
      );
    });
    return json(res, 201, response);
  }
  let offer;
  try {
    offer = await duffel("/air/offers/" + input.offerId);
    if (
      !Number.isInteger(input.expectedAmountCents) ||
      input.expectedAmountCents !== Math.round(Number(offer.total_amount) * 100)
    )
      throw new HttpError(
        409,
        "Le tarif a changé. Relancez la recherche avant de confirmer.",
      );
    if (
      offer.total_currency !== "EUR" ||
      !Number.isFinite(Number(offer.total_amount)) ||
      Number(offer.total_amount) <= 0 ||
      Number(offer.total_amount) > 1000
    )
      throw new HttpError(
        422,
        "Le paiement en espèces est limité à 1 000 € en EUR.",
      );
    if (offer.payment_requirements?.requires_instant_payment !== false)
      throw new HttpError(
        409,
        "Cette offre exige un paiement immédiat et ne peut pas être retenue.",
      );
    const guarantee = Date.parse(
        offer.payment_requirements.price_guarantee_expires_at,
      ),
      deadline = Date.parse(offer.payment_requirements.payment_required_by);
    if (
      !Number.isFinite(guarantee) ||
      !Number.isFinite(deadline) ||
      Math.min(guarantee, deadline) < Date.now() + 7200000
    )
      throw new HttpError(
        409,
        "Cette offre ne garantit pas deux heures de retenue au tarif affiché.",
      );
    if (
      offer.passengers.length !== passengers.length ||
      new Set(passengers.map((p) => p.id)).size !== passengers.length ||
      !passengers.every((p) => offer.passengers.some((o) => o.id === p.id))
    )
      throw new HttpError(400, "Les passagers ne correspondent pas à l’offre.");
  } catch (error) {
    await db.query("DELETE FROM checkout_requests WHERE idempotency_key=$1", [
      key,
    ]);
    throw error;
  }
  const order = await duffel("/air/orders", {
    type: "hold",
    selected_offers: [input.offerId],
    passengers,
    metadata: { checkout_key: key },
  });
  const expiresAt = Math.min(
    Date.now() + 7200000,
    Date.parse(order.payment_status?.payment_required_by),
    Date.parse(order.payment_status?.price_guarantee_expires_at),
  );
  if (order.payment_status?.awaiting_payment !== true || !Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new HttpError(
      502,
      "Échéance fournisseur invalide. Rapprochement opérateur requis.",
    );
  const hold = {
    kind: "hold",
    id: order.id,
    amountCents: Math.round(Number(order.total_amount) * 100),
    currency: order.total_currency,
    expiresAt,
    simulation: false,
  };
  if (
    hold.currency !== "EUR" ||
    !Number.isInteger(hold.amountCents) ||
    hold.amountCents !== input.expectedAmountCents ||
    hold.amountCents < 1 ||
    hold.amountCents > 100000
  )
    throw new HttpError(
      502,
      "Le montant retenu doit être rapproché avec le fournisseur.",
    );
  const response = {
    ...hold,
    token: sign(hold),
    accessToken: sign({
      kind: "order-access",
      id: order.id,
      expiresAt: Date.now() + 90 * 86400000,
    }),
    payment_required_by: new Date(expiresAt).toISOString(),
    bookingReference: order.booking_reference,
  };
  await transaction(async (db) => {
    await db.query(
      "INSERT INTO flight_orders(id,amount_cents,currency,expires_at) VALUES($1,$2,$3,$4)",
      [hold.id, hold.amountCents, hold.currency, new Date(expiresAt)],
    );
    await db.query(
      "UPDATE checkout_requests SET state='held',response=$2 WHERE idempotency_key=$1",
      [key, response],
    );
  });
  json(res, 201, response);
});
