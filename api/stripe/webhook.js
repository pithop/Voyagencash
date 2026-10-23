const crypto = require("node:crypto");
const { endpoint, rawBody, json, HttpError } = require("../../server/http.js");
const { transaction } = require("../../server/database.js");

const handler = endpoint("POST", async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "La vérification Stripe doit être configurée.");
  const raw = await rawBody(req);
  const parts = String(req.headers["stripe-signature"] || "").split(",").map(p => p.trim().split("="));
  const timestamps = parts.filter(([k]) => k === "t");
  const timestamp = timestamps[0]?.[1];
  if (timestamps.length !== 1 || !/^\d{10}$/.test(timestamp || "") || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    throw new HttpError(401, "Horodatage Stripe invalide.");
  const expected = crypto.createHmac("sha256", secret).update(timestamp + ".").update(raw).digest();
  if (!parts.some(([k, v]) => k === "v1" && /^[a-f0-9]{64}$/i.test(v || "") && crypto.timingSafeEqual(Buffer.from(v, "hex"), expected)))
    throw new HttpError(401, "Signature Stripe invalide.");
  let event;
  try { event = JSON.parse(raw); } catch { throw new HttpError(400, "JSON Stripe invalide."); }
  if (!/^evt_[A-Za-z0-9_]{1,100}$/.test(event?.id || "") || typeof event.type !== "string")
    throw new HttpError(400, "Événement Stripe invalide.");
  if (event.type !== "payment_intent.succeeded") return json(res, 200, { received: true, ignored: true });
  const pi = event.data?.object, orderId = pi?.metadata?.orderId;
  if (!/^pi_[A-Za-z0-9_]{1,100}$/.test(pi?.id || "") || pi.status !== "succeeded" ||
      !Number.isInteger(pi.amount_received) || pi.amount_received < 1 || !/^[a-z]{3}$/.test(pi.currency || "") ||
      typeof event.livemode !== "boolean" || typeof pi.livemode !== "boolean" ||
      !Number.isInteger(event.created) || (orderId != null && (typeof orderId !== "string" || orderId.length > 200)))
    throw new HttpError(400, "Encaissement Stripe invalide.");
  const eventKey = `stripe:${event.id}`;
  const result = await transaction(async db => {
    const { rows: [order] } = await db.query("SELECT * FROM flight_orders WHERE id=$1 FOR UPDATE", [orderId || ""]);
    const { rows: seen } = await db.query("SELECT event_key FROM payment_receipts WHERE event_key=$1", [eventKey]);
    if (seen.length) return { received: true, duplicate: true };
    const { rows: [attempt] } = await db.query("SELECT * FROM payment_attempts WHERE order_id=$1", [orderId || ""]);
    // A webhook can beat the response that stores the PaymentIntent ID. Ask Stripe to retry.
    if (order && attempt && !attempt.payment_id && order.payment_method === "card")
      throw new HttpError(503, "Tentative de paiement en cours de rapprochement.");
    const { rows: paid } = await db.query("SELECT event_key FROM payment_receipts WHERE provider='stripe' AND payment_id=$1 AND result IN ('accepted','refund_pending')", [pi.id]);
    const matched = order && attempt && attempt.payment_id === pi.id && attempt.livemode === pi.livemode &&
      pi.livemode === event.livemode && order.amount_cents === pi.amount_received &&
      attempt.amount_cents === pi.amount_received && order.currency === pi.currency.toUpperCase();
    const expired = order && new Date(order.expires_at).getTime() <= Date.now();
    const outcome = matched && paid.length ? "duplicate" : matched && order.status === "awaiting_card" && order.payment_method === "card"
      ? (expired ? "refund_pending" : "accepted") : "reconciliation_required";
    const inserted = await db.query("INSERT INTO payment_receipts(event_key,provider,payment_id,order_id,amount_cents,currency,result,paid_at) VALUES($1,'stripe',$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING event_key",
      [eventKey, pi.id, orderId || null, pi.amount_received, pi.currency.toUpperCase(), outcome, new Date(event.created * 1000)]);
    if (!inserted.rowCount) return { received: true, duplicate: true };
    if (["accepted", "refund_pending"].includes(outcome)) {
      await db.query("INSERT INTO payment_events(id,order_id) VALUES($1,$2)", [eventKey, order.id]);
      await db.query("UPDATE flight_orders SET status=$2 WHERE id=$1", [order.id, expired ? "refund_pending" : "payment_received"]);
      await db.query("UPDATE payment_attempts SET state='succeeded' WHERE order_id=$1", [order.id]);
      await db.query("INSERT INTO payment_outbox(order_id,event_id,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [order.id, eventKey, expired ? "refund_pending" : "pending"]);
    }
    return { received: true, state: outcome, reconciliation_required: outcome === "reconciliation_required", duplicate: outcome === "duplicate" };
  });
  json(res, 200, result);
});
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
