const crypto = require("node:crypto");
const { endpoint, body, json, HttpError, verify } = require("../../server/http.js");
const { database } = require("../../server/database.js");

module.exports = endpoint("POST", async (req, res) => {
  const input = await body(req);
  const { holdToken, orderId } = input;

  let hold;
  if (holdToken) {
    try {
      hold = verify(holdToken, "hold");
    } catch {
      throw new HttpError(400, "Jeton de réservation invalide ou corrompu.");
    }
  }

  const effectiveOrderId = orderId || hold?.id;
  if (!effectiveOrderId) {
    throw new HttpError(400, "Identifiant de commande manquant.");
  }

  let amountCents = hold?.amountCents;
  let currency = hold?.currency || "EUR";

  // Check database if available
  if (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) {
    try {
      const { rows } = await database().query(
        "SELECT id, amount_cents, currency, status, expires_at FROM flight_orders WHERE id=$1",
        [effectiveOrderId],
      );
      if (rows.length > 0) {
        const order = rows[0];
        if (new Date(order.expires_at).getTime() < Date.now()) {
          throw new HttpError(410, "Le délai de réservation de 120 minutes est expiré.");
        }
        amountCents = order.amount_cents;
        currency = order.currency;
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
    }
  }

  if (!amountCents || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HttpError(400, "Montant invalide.");
  }

  // If live Stripe secret is configured, create a real Stripe PaymentIntent
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && !process.env.VOYAGENCASH_TEST_MODE) {
    try {
      const form = new URLSearchParams({
        amount: String(amountCents),
        currency: currency.toLowerCase(),
        "metadata[orderId]": effectiveOrderId,
        "metadata[platform]": "voyagencash",
        "automatic_payment_methods[enabled]": "true",
      });

      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Erreur Stripe");
      }

      const pi = await response.json();
      return json(res, 200, {
        clientSecret: pi.client_secret,
        id: pi.id,
        amountCents,
        currency,
        orderId: effectiveOrderId,
        live: true,
      });
    } catch (error) {
      throw new HttpError(502, `Échec de l'initialisation Stripe: ${error.message}`);
    }
  }

  // Simulation mode (no Stripe secret configured or in test mode)
  const simId = `pi_sim_${crypto.randomBytes(12).toString("hex")}`;
  const simSecret = `${simId}_secret_${crypto.randomBytes(16).toString("hex")}`;

  return json(res, 200, {
    clientSecret: simSecret,
    id: simId,
    amountCents,
    currency,
    orderId: effectiveOrderId,
    live: false,
    simulation: true,
  });
});
