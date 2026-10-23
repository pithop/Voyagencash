const crypto = require("node:crypto");
const { endpoint, body, json, HttpError, verify } = require("../../server/http.js");
const { transaction } = require("../../server/database.js");

module.exports = endpoint("POST", async (req, res) => {
  const { holdToken, orderId } = await body(req);
  if (!holdToken) throw new HttpError(400, "Jeton de réservation requis.");
  const hold = verify(holdToken, "hold");
  if (orderId && orderId !== hold.id) throw new HttpError(403, "Réservation non concordante.");
  if (!Number.isInteger(hold.amountCents) || hold.amountCents <= 0 || hold.currency !== "EUR")
    throw new HttpError(400, "Montant invalide.");
  if (hold.simulation === true) {
    if (process.env.VOYAGENCASH_TEST_MODE !== "true")
      throw new HttpError(409, "Cette réservation appartient à la démonstration.");
    const id = `pi_sim_${crypto.createHash("sha256").update(holdToken).digest("hex").slice(0, 24)}`;
    return json(res, 200, { id, clientSecret: `${id}_secret_demo`, orderId: hold.id,
      amountCents: hold.amountCents, currency: hold.currency, live: false, simulation: true });
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!stripeKey || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.VOUCHER_SIGNING_SECRET)
    throw new HttpError(503, "Le paiement Stripe doit être configuré.");
  const livemode = /^(sk|rk)_live_/.test(stripeKey);
  const attempt = await transaction(async db => {
    const { rows: [order] } = await db.query("SELECT * FROM flight_orders WHERE id=$1 FOR UPDATE", [hold.id]);
    if (!order) throw new HttpError(404, "Réservation introuvable.");
    if (!["awaiting_cash", "awaiting_card"].includes(order.status))
      throw new HttpError(409, "Cette réservation ne peut plus être réglée.");
    if (new Date(order.expires_at).getTime() <= Date.now()) throw new HttpError(410, "La réservation a expiré.");
    if (order.amount_cents !== hold.amountCents || order.currency !== hold.currency)
      throw new HttpError(409, "Le montant de la réservation a changé.");
    if (order.voucher_reference || order.payment_method === "cash")
      throw new HttpError(409, "Un bon espèces est déjà actif pour cette réservation.");
    await db.query("INSERT INTO payment_attempts(order_id,idempotency_key,amount_cents,currency,livemode) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [hold.id, `order:${hold.id}:v1`, order.amount_cents, order.currency, livemode]);
    const { rows: [saved] } = await db.query("SELECT * FROM payment_attempts WHERE order_id=$1", [hold.id]);
    if (saved.livemode !== livemode || saved.amount_cents !== order.amount_cents ||
        (!saved.payment_id && Date.now() - new Date(saved.created_at).getTime() > 23 * 3600000))
      throw new HttpError(409, "La tentative de paiement nécessite un rapprochement.");
    await db.query("UPDATE flight_orders SET status='awaiting_card',payment_method='card' WHERE id=$1", [hold.id]);
    return saved;
  });
  const form = new URLSearchParams({ amount: String(attempt.amount_cents), currency: attempt.currency.toLowerCase(),
    "metadata[orderId]": hold.id, "metadata[platform]": "voyagencash", "automatic_payment_methods[enabled]": "true" });
  let pi;
  try {
    const response = await fetch("https://api.stripe.com/v1/payment_intents" + (attempt.payment_id ? "/" + encodeURIComponent(attempt.payment_id) : ""), {
      method: attempt.payment_id ? "GET" : "POST", redirect: "error",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": attempt.idempotency_key },
      ...(attempt.payment_id ? {} : { body: form.toString() }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("stripe_unavailable");
    pi = await response.json();
    if (!/^pi_[A-Za-z0-9]+$/.test(pi.id || "") || typeof pi.client_secret !== "string" ||
        pi.amount !== attempt.amount_cents || pi.currency?.toUpperCase() !== attempt.currency ||
        pi.livemode !== attempt.livemode || pi.metadata?.orderId !== hold.id)
      throw new Error("stripe_invalid_response");
  } catch {
    throw new HttpError(502, "Initialisation Stripe indisponible. Réessayez pour reprendre la même tentative.");
  }
  await transaction(async db => {
    await db.query("SELECT id FROM flight_orders WHERE id=$1 FOR UPDATE", [hold.id]);
    const { rows: [saved] } = await db.query("SELECT * FROM payment_attempts WHERE order_id=$1", [hold.id]);
    if (saved.payment_id && saved.payment_id !== pi.id) throw new HttpError(409, "Paiement à rapprocher.");
    await db.query("UPDATE payment_attempts SET payment_id=$2 WHERE order_id=$1", [hold.id, pi.id]);
  });
  json(res, 200, { clientSecret: pi.client_secret, id: pi.id, amountCents: attempt.amount_cents,
    currency: attempt.currency, orderId: hold.id, live: true });
});
