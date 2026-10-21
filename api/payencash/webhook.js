const crypto = require("node:crypto");
const { endpoint, rawBody, json, HttpError } = require("../../server/http.js");
const { transaction } = require("../../server/database.js");
const handler = endpoint("POST", async (req, res) => {
  const secret = process.env.PAYENCASH_WEBHOOK_SECRET;
  if (!secret)
    throw new HttpError(
      503,
      "La vérification des notifications doit être configurée.",
    );
  const raw = await rawBody(req),
    timestamp = req.headers["x-payencash-timestamp"],
    signature = req.headers["x-payencash-signature"];
  if (
    !/^\d{10}$/.test(timestamp || "") ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature || "")
  )
    throw new HttpError(401, "Signature ou horodatage invalide.");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(raw)
    .digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex")))
    throw new HttpError(401, "Signature invalide.");
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON invalide.");
  }
  if (
    !event || typeof event !== "object" ||
    typeof event.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(event.id) ||
    event.type !== "voucher.paid" ||
    typeof event.orderId !== "string" ||
    !Number.isInteger(event.amountCents) ||
    event.currency !== "EUR"
  )
    throw new HttpError(400, "Notification invalide.");
  const result = await transaction(async (db) => {
    const {
      rows: [order],
    } = await db.query("SELECT * FROM flight_orders WHERE id=$1 FOR UPDATE", [
      event.orderId,
    ]);
    if (
      !order ||
      order.voucher_reference !== event.reference ||
      order.amount_cents !== event.amountCents ||
      order.currency !== event.currency
    )
      throw new HttpError(409, "Montant ou référence non concordants.");
    const { rows: seen } = await db.query(
      "SELECT id,order_id FROM payment_events WHERE id=$1",
      [event.id],
    );
    if (seen.length) {
      if (seen[0].order_id !== event.orderId)
        throw new HttpError(
          409,
          "Identifiant d’événement déjà attribué à une autre commande.",
        );
      return { received: true, duplicate: true };
    }
    if (order.status !== "awaiting_cash")
      throw new HttpError(409, "Cette réservation a déjà été traitée.");
    const expired = new Date(order.expires_at).getTime() <= Date.now();
    await db.query("INSERT INTO payment_events(id,order_id) VALUES($1,$2)", [
      event.id,
      event.orderId,
    ]);
    await db.query("UPDATE flight_orders SET status=$2 WHERE id=$1", [
      event.orderId,
      expired ? "refund_pending" : "payment_received",
    ]);
    await db.query(
      "INSERT INTO payment_outbox(order_id,event_id,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [event.orderId, event.id, expired ? "refund_pending" : "pending"],
    );
    return {
      received: true,
      state: expired ? "refund_pending" : "payment_received",
    };
  });
  // No false "ticket issued": a durable outbox must be processed by the operator's fulfilment worker.
  json(res, 200, result);
});
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
