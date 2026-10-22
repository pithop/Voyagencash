const crypto = require("node:crypto");
const { endpoint, rawBody, json, HttpError } = require("../../server/http.js");
const { transaction } = require("../../server/database.js");

const handler = endpoint("POST", async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await rawBody(req);
  const signatureHeader = req.headers["stripe-signature"];

  // If secret is set, verify cryptographic HMAC signature
  if (secret) {
    if (!signatureHeader) {
      throw new HttpError(401, "En-tête stripe-signature manquant.");
    }

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((item) => {
        const [k, v] = item.trim().split("=");
        return [k, v];
      }),
    );

    const timestamp = parts.t;
    const sig = parts.v1;

    if (!timestamp || !sig || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
      throw new HttpError(401, "Horodatage de notification Stripe expiré ou invalide.");
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");

    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
    ) {
      throw new HttpError(401, "Signature Stripe invalide.");
    }
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON Stripe invalide.");
  }

  if (!event || typeof event !== "object" || !event.type) {
    throw new HttpError(400, "Événement Stripe malformé.");
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data?.object;
    const orderId = pi?.metadata?.orderId;
    const amountReceived = pi?.amount_received ?? pi?.amount;

    if (!orderId || !amountReceived) {
      return json(res, 200, { received: true, ignored: true });
    }

    if (process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL) {
      const result = await transaction(async (db) => {
        const {
          rows: [order],
        } = await db.query("SELECT * FROM flight_orders WHERE id=$1 FOR UPDATE", [
          orderId,
        ]);

        if (!order) {
          return { received: true, not_found: true };
        }

        const { rows: seen } = await db.query(
          "SELECT id, order_id FROM payment_events WHERE id=$1",
          [event.id],
        );

        if (seen.length) {
          return { received: true, duplicate: true };
        }

        const expired = new Date(order.expires_at).getTime() <= Date.now();
        await db.query("INSERT INTO payment_events(id, order_id) VALUES($1, $2)", [
          event.id,
          orderId,
        ]);

        const nextStatus = expired ? "refund_pending" : "payment_received";
        await db.query("UPDATE flight_orders SET status=$2 WHERE id=$1", [
          orderId,
          nextStatus,
        ]);

        await db.query(
          "INSERT INTO payment_outbox(order_id, event_id, state) VALUES($1, $2, $3) ON CONFLICT DO NOTHING",
          [orderId, event.id, expired ? "refund_pending" : "pending"],
        );

        return {
          received: true,
          orderId,
          state: nextStatus,
        };
      });

      return json(res, 200, result);
    }
  }

  return json(res, 200, { received: true });
});

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
