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
    const eventKey = `payencash:${event.id}`;
    const { rows: seen } = await db.query("SELECT event_key FROM payment_receipts WHERE event_key=$1", [eventKey]);
    if (seen.length) return { received: true, duplicate: true };
    const paymentId = typeof event.paymentId === "string" ? event.paymentId : event.reference;
    if (typeof paymentId !== "string" || paymentId.length > 200) throw new HttpError(400, "Référence de paiement invalide.");
    const { rows: paid } = await db.query("SELECT event_key FROM payment_receipts WHERE provider='payencash' AND payment_id=$1 AND result IN ('accepted','refund_pending')", [paymentId]);
    const matched = order && order.voucher_reference === event.reference && order.amount_cents === event.amountCents && order.currency === event.currency;
    const expired = order && new Date(order.expires_at).getTime() <= Date.now();
    const outcome = matched && paid.length ? "duplicate" : matched && order.status === "awaiting_cash" && order.payment_method !== "card"
      ? expired ? "refund_pending" : "accepted" : "reconciliation_required";
    const inserted = await db.query("INSERT INTO payment_receipts(event_key,provider,payment_id,order_id,amount_cents,currency,result) VALUES($1,'payencash',$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_key",
      [eventKey, paymentId, event.orderId, event.amountCents, event.currency, outcome]);
    if (!inserted.rowCount) return { received: true, duplicate: true };
    if (["accepted", "refund_pending"].includes(outcome)) {
      await db.query("INSERT INTO payment_events(id,order_id) VALUES($1,$2)", [eventKey, event.orderId]);
      await db.query("UPDATE flight_orders SET status=$2 WHERE id=$1", [event.orderId, expired ? "refund_pending" : "payment_received"]);
      await db.query("INSERT INTO payment_outbox(order_id,event_id,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [event.orderId, eventKey, expired ? "refund_pending" : "pending"]);
    }
    return { received: true, state: outcome === "accepted" ? "payment_received" : outcome, duplicate: outcome === "duplicate" };
  });
  // No false "ticket issued": a durable outbox must be processed by the operator's fulfilment worker.
  json(res, 200, result);
});
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
